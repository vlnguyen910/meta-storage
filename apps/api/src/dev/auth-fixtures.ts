// Local development credentials only; shared by Swagger examples and seed:auth.
export const DEV_AUTH_PASSWORD = "StoreXDev123!";

export const DEV_AUTH_ACCOUNTS = [
  { role: "CUSTOMER", email: "customer@metastorage.vn", name: "Lê Thị Mai Linh" },
  { role: "FACILITY_STAFF", email: "staff@metastorage.vn", name: "Trần Quốc Huy" },
  { role: "FACILITY_MANAGER", email: "manager@metastorage.vn", name: "Lê Thu Hà" },
  {
    role: "BUSINESS_OPERATION_MANAGER",
    email: "bom@metastorage.vn",
    name: "Business Operation Manager",
  },
] as const;
