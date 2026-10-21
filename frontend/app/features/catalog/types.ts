export type NumberType = "mobile" | "local" | "toll_free";

export type CarrierProvider = "Bandwidth" | "Twilio" | "Sinch" | "Infobip";

export type VirtualNumberCatalogItem = {
  id: string;
  phoneNumber: string;
  e164: string;
  countryCode: string;
  countryName: string;
  region: string;
  numberType: NumberType;
  capabilities: string[];
  carrierProvider: CarrierProvider;
  monthlyFee: number;
  perSmsFee: number;
  status: "available" | "allocated";
};

