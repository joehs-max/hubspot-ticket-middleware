const HUBSPOT_BASE = "https://api.hubapi.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional simple auth: check a shared API key
  const expectedKey = process.env.INBOUND_API_KEY;
  const incomingKey = req.headers["x-api-key"];
  if (expectedKey && incomingKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { ticket_id } = req.body || {};

    if (!ticket_id) {
      return res.status(400).json({ error: "ticket_id is required" });
    }

    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    if (!token) {
      return res
        .status(500)
        .json({ error: "Missing HUBSPOT_PRIVATE_APP_TOKEN env var" });
    }

    // Call HubSpot tickets search API
    const hubspotResponse = await fetch(
      `${HUBSPOT_BASE}/crm/v3/objects/tickets/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "ticket_id",
                  operator: "EQ",
                  value: String(ticket_id),
                },
              ],
            },
          ],
          properties: [
            "ticket_id",
            "customer_ticket_stage",
            "customer_ticket_description",
            "customer_ticket_outlook",
          ],
          limit: 1,
        }),
      }
    );

    if (!hubspotResponse.ok) {
      const text = await hubspotResponse.text();
      console.error("HubSpot error:", text);
      return res
        .status(hubspotResponse.status)
        .json({ error: "HubSpot API error", details: text });
    }

    const data = await hubspotResponse.json();

    if (!data.total || data.total === 0) {
      return res.status(404).json({ found: false });
    }

    const ticket = data.results[0].properties;

    // Normalized response for HubSpot action
    return res.status(200).json({
      found: true,
      ticket_id: ticket.ticket_id,
      customer_ticket_stage: ticket.customer_ticket_stage,
      customer_ticket_description: ticket.customer_ticket_description,
      customer_ticket_outlook: ticket.customer_ticket_outlook,
    });
  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
