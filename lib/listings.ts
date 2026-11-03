export const origin='https://buyandselllasers.com';
export type Listing={id:string;name:string;brand:string;year:string;category:string;price:number;image:string;path:string;location?:string;};
export const listings:Listing[]=[
 {id:'aw3',name:'Schnelle Ultra',brand:'AW3',year:'2024',category:'Hair removal',price:9500,image:'aw3-main',path:'/laser-hair-removal-machines/aw3-schnelle-ultra-2024/',location:'Burton on Trent'},
 {id:'quirumed',name:'Q-Switched Nd:YAG',brand:'Quirumed',year:'2020',category:'Tattoo removal',price:1200,image:'quirumed',path:'/laser-tattoo-removal-machines/quirumed-q-switched-ndyag-2020/'},
 {id:'ellipse',name:'Light SPT',brand:'Ellipse',year:'2008',category:'IPL',price:1350,image:'ellipse',path:'/ipl-machines/ellipse-light-spt-2008/'},
 {id:'cynosure',name:'Revlite',brand:'Cynosure',year:'2009',category:'Tattoo removal',price:30000,image:'cynosure',path:'/laser-tattoo-removal-machines/cynosure-revlite-palomar-alma-revlite-2009/'},
 {id:'cosmedico',name:'Skinpulse 900 IPL & RF',brand:'Cosmedico',year:'2017',category:'IPL',price:2800,image:'cosmedico',path:'/ipl-machines/cosmedico-skinpulse-900-ipl-and-rf-cosmedico-2017/'},
 {id:'vcombo',name:'V Combo Plus',brand:'All White Laser',year:'2024',category:'All-in-one',price:17500,image:'vcombo',path:'/all-in-one-machines/all-white-lasee-v-combo-plus-2024/'}
];
export const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
export const categories=[{name:'Hair removal',path:'/laser-hair-removal-machines/'},{name:'Tattoo removal',path:'/laser-tattoo-removal-machines/'},{name:'IPL',path:'/ipl-machines/'},{name:'All-in-one',path:'/all-in-one-machines/'},{name:'Skin treatment',path:'/skin-treatment-machine/'},{name:'Slimming',path:'/slimming-machines/'}];
