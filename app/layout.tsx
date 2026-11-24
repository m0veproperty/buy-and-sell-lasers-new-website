import type { Metadata } from 'next';
import './globals.css';
import './journey.css';
import './refinements.css';
import './direction-v2.css';
import './direction-v3.css';
import './direction-v4.css';
import './interior.css';
import './account.css';
import './category.css';
import './aura.css';
import './seller.css';
import './editorial-refresh.css';
import './product-refresh.css';
import './editorial-responsive.css';
export const metadata: Metadata = {
 metadataBase: new URL(process.env.SITE_URL||'https://buy-and-sell-lasers-new-website.vercel.app'),
 title: 'Buy & Sell Lasers | Your next laser. A clearer choice.',
 description: 'Explore pre-owned laser and aesthetic equipment. Inspect real listings, compare the details and connect directly with sellers.',
 robots: { index: true, follow: true },
};
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="en-GB"><body>{children}</body></html>;
}
