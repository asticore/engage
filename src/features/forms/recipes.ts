/**
 * "Get form data out" guide: Zapier or Make style tools, a pasted webhook URL,
 * and pulling entries with an API key. Served as Markdown from the admin
 * (/api/admin-form-webhooks?docs=1) and kept in docs/form-data-recipes.md.
 */
export const FORM_DATA_RECIPES = `# Getting form data into other systems

Three ways, from simplest to most flexible.

## 1. Email it to someone

In the form editor, open Notifications and add a rule. Put one or more addresses in "Send to". Use "Only when" to route by an answer (Department is Sales goes to sales@). "Also send to" adds visible recipients; "Hidden copies" sends each address its own message. To send a past entry to someone new, press Forward on the entry in the form's Submissions tab. Files are sent as links that stop working after 7 days. This needs an email provider connected under Integrations.

## 2. Push each new entry to a webhook (Zapier, Make, n8n, your own server)

Zapier: create a Zap with the trigger "Webhooks by Zapier, Catch Hook". Copy the custom webhook URL. Make: add the module "Webhooks, Custom webhook" and copy its address. In the form editor, open Webhooks, add one, paste the URL and press Send test. The test sends a made-up entry with the event name form.test so the tool can learn the fields. Then submit the real form once; each entry arrives as JSON:

    { "event": "form.submitted", "deliveryId": "12-w1-1", "form": { "id": 3, "title": "Contact" },
      "submission": { "id": 12, "submittedAt": "2026-11-16T05:00:00.000Z", "values": { "name": "Ada" }, "labels": { "name": "Name" } },
      "meta": { "pageUrl": "https://example.com/contact", "status": "new" } }

"What to send" limits the answers to the fields you name. "Include page address, consent record and status" adds the meta block. A signature header X-Form-Signature (t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">) is sent when you set a signing secret. If the receiving tool cannot check signatures, set a shared secret header instead (for example X-Api-Key) and check its value.

A delivery that fails is tried again after 5 minutes, 30 minutes, 2 hours and 12 hours. The delivery log in the Webhooks section shows each attempt with its status code; Re-send sends one entry again at any time.

## 3. Pull entries with an API key

Create a key under Security > API keys with the scopes forms:read (field definitions) and form-submissions:read (entries). The key's owner must be allowed to read form entries. Send it as "Authorization: Bearer egk_..." .

    GET /api/forms/3                       field names, labels, types, options
    GET /api/forms/3/submissions?since=2026-11-09&until=2026-11-15&limit=100&page=1
    GET /api/forms/3/submissions?format=csv&since=2026-11-09

Entries come oldest first, so a puller can remember the last submittedAt and ask for since=<that> next time. Spam entries, IP addresses, browser details and internal notes are never returned. Files come back as name, size, type and a link that stops working after 7 days. In Zapier use "Webhooks by Zapier, GET" on a schedule; in Make use "HTTP, Make a request".
`
