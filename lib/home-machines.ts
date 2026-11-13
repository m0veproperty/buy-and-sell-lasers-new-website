export type HomeMachine = {
  id:string;
  title:string;
  category:string[];
  year:string;
  price:number|null;
  image?:string;
  href?:string;
  description?:string;
  featured:boolean;
  spotlight?:string;
};
