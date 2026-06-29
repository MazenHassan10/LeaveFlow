import { submitTimeOffRequest } from "@/app/actions";

export function RequestForm() {
  return (
    <form action={submitTimeOffRequest} className="panel form-panel">
      <h2>New request</h2>
      <label>
        Request type
        <select name="requestType">
          <option>PTO</option>
          <option>Additional Time Off</option>
          <option>Emergency/Exception</option>
        </select>
      </label>
      <label>
        Reason
        <textarea name="reason" placeholder="Brief written request" />
      </label>
      <h3>Time off</h3>
      <div className="field-grid">
        <label>Date <input name="segmentDate" type="date" required /></label>
        <label>From <input name="segmentStart" type="time" required /></label>
        <label>To <input name="segmentEnd" type="time" required /></label>
      </div>
      <h3>Make-up plan</h3>
      <div className="field-grid">
        <label>Date <input name="makeupDate" type="date" /></label>
        <label>From <input name="makeupStart" type="time" /></label>
        <label>To <input name="makeupEnd" type="time" /></label>
      </div>
      <button type="submit">Submit request</button>
    </form>
  );
}
