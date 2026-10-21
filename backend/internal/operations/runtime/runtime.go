// Package runtime wires development business state to the durable River queue.
package runtime

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"log/slog"
	"numdock/backend/internal/operations/postgres"
	"time"
)

type Task struct {
	Task string `json:"task"`
	ID   string `json:"id"`
}

func (Task) Kind() string { return "numdock_task" }

type worker struct {
	river.WorkerDefaults[Task]
	store *postgres.Store
}

func (w *worker) Work(ctx context.Context, j *river.Job[Task]) error {
	return w.store.RunTask(ctx, j.Args.Task, j.Args.ID)
}

type Runtime struct {
	Store       *postgres.Store
	client      *river.Client[pgx.Tx]
	development bool
}

func New(pool *pgxpool.Pool, key []byte, development bool, logger *slog.Logger) (*Runtime, error) {
	s, err := postgres.New(pool, key, development)
	if err != nil {
		return nil, err
	}
	out := &Runtime{Store: s, development: development}
	if !development {
		return out, nil
	}
	var schema string
	if err = pool.QueryRow(context.Background(), "SELECT current_schema()").Scan(&schema); err != nil {
		return nil, err
	}
	workers := river.NewWorkers()
	river.AddWorker(workers, &worker{store: s})
	client, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Schema: schema, Workers: workers, Logger: logger, Queues: map[string]river.QueueConfig{river.QueueDefault: {MaxWorkers: 4}}})
	if err != nil {
		return nil, err
	}
	out.client = client
	s.SetEnqueuer(func(ctx context.Context, tx pgx.Tx, task, id string, when time.Time) error {
		_, err := client.InsertTx(ctx, tx, Task{Task: task, ID: id}, &river.InsertOpts{ScheduledAt: when, MaxAttempts: 10})
		return err
	})
	return out, nil
}
func (r *Runtime) Start(ctx context.Context) error {
	if r.client == nil {
		return nil
	}
	return r.client.Start(ctx)
}
func (r *Runtime) Stop(ctx context.Context) error {
	if r.client == nil {
		return nil
	}
	return r.client.Stop(ctx)
}
