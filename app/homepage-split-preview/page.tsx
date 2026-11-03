import type {Metadata} from 'next';
import Home from '@/components/Home';
import './split.css';
export const metadata:Metadata={title:'Split homepage preview | Buy & Sell Lasers',robots:{index:false,follow:false}};
export default function Page(){return <Home variant="split"/>;}
