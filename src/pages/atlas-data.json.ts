// Compact atlas and geometry for the browser (explorer, profile map).
import { clientData } from '../lib/atlas.ts';

export function GET() {
  return new Response(JSON.stringify(clientData()), { headers: { 'Content-Type': 'application/json' } });
}
