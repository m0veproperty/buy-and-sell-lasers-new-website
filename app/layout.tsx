import type { Metadata } from 'next';
import './globals.css';
import './journey.css';
import './refinements.css';
import './direction-v2.css';
import './direction-v3.css';
import './direction-v4.css';
import './interior.css';
import './account.css';
export const metadata: Metadata = {
 title: 'Buy & Sell Lasers | Your next laser. A clearer choice.',
 description: 'Explore pre-owned laser and aesthetic equipment. Inspect real listings, compare the details and connect directly with sellers.',
 robots: { index: false, follow: false },
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en-GB"><body>{children}</body></html>;
}
