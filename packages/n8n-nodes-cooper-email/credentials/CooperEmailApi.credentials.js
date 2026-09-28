class CooperEmailApi {
  constructor() {
    this.name = "cooperEmailApi";
    this.displayName = "Cooper Email API";
    this.documentationUrl = "https://cooperemail.com/docs";
    this.properties = [
      {
        displayName: "API Key",
        name: "apiKey",
        type: "string",
        typeOptions: { password: true },
        default: "",
        description: "Bearer key from POST /api/v1/onboard (coop_live_…). Onboard itself does not need a key.",
      },
      {
        displayName: "Base URL",
        name: "baseUrl",
        type: "string",
        default: "https://cooperemail.com",
      },
    ];
  }
}

module.exports = { CooperEmailApi };
