"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type PosOrder = { id:number; total:number; payment_method:string; status:string; order_type:string; created_at:string; closed_at:string|null };
type OpenOrder = { id:number; table_id:number|null; total:number; order_type:string };
type StockItem = { id:number; name:string; unit:string; current_quantity:number; minimum_quantity:number };
type OrderItem = { id:number; order_id:number; product_name:string; quantity:number; line_total:number };

const BRAND_FONT='"American Typewriter", "Courier New", Courier, monospace';

function money(value:number){return Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:0,maximumFractionDigits:2});}
function qty(value:number){return Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:0,maximumFractionDigits:3});}
function todayRange(){const now=new Date();return{start:new Date(now.getFullYear(),now.getMonth(),now.getDate()),end:new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)}}

export default function PosDashboardPage(){
  const [orders,setOrders]=useState<PosOrder[]>([]);
  const [openOrders,setOpenOrders]=useState<OpenOrder[]>([]);
  const [stockItems,setStockItems]=useState<StockItem[]>([]);
  const [orderItems,setOrderItems]=useState<OrderItem[]>([]);
  const [loading,setLoading]=useState(true);

  const loadDashboard=useCallback(async()=>{
    setLoading(true);
    const {start,end}=todayRange();
    const [closed,open,stock]=await Promise.all([
      supabase.from("pos_orders").select("id,total,payment_method,status,order_type,created_at,closed_at").eq("status","closed").gte("closed_at",start.toISOString()).lt("closed_at",end.toISOString()).order("closed_at",{ascending:false}),
      supabase.from("pos_orders").select("id,table_id,total,order_type").eq("status","open"),
      supabase.from("stock_items").select("id,name,unit,current_quantity,minimum_quantity").eq("active",true).order("current_quantity",{ascending:true}),
    ]);
    const err=closed.error||open.error||stock.error;
    if(err){alert(`Dashboard yüklenemedi: ${err.message}`);setLoading(false);return;}
    const loaded=(closed.data??[]) as PosOrder[];
    setOrders(loaded);setOpenOrders((open.data??[]) as OpenOrder[]);setStockItems((stock.data??[]) as StockItem[]);
    if(!loaded.length){setOrderItems([]);setLoading(false);return;}
    const ids=loaded.map(x=>x.id);
    const items=await supabase.from("pos_order_items").select("id,order_id,product_name,quantity,line_total").in("order_id",ids);
    if(items.error){alert(`Ürün verileri yüklenemedi: ${items.error.message}`);setLoading(false);return;}
    setOrderItems((items.data??[]) as OrderItem[]);setLoading(false);
  },[]);

  useEffect(()=>{void loadDashboard();},[loadDashboard]);

  const summary=useMemo(()=>orders.reduce((r,o)=>{const v=Number(o.total||0);r.orderCount++;if(o.payment_method==="internal")r.internal+=v;else r.revenue+=v;if(o.order_type==="Masa")r.tableOrders++;else if(o.order_type==="Paket")r.packageOrders++;else if(o.order_type==="Gel-Al")r.pickupOrders++;return r;},{orderCount:0,revenue:0,internal:0,tableOrders:0,packageOrders:0,pickupOrders:0}),[orders]);
  const average=summary.orderCount?summary.revenue/summary.orderCount:0;
  const critical=useMemo(()=>stockItems.filter(x=>Number(x.current_quantity)<=Number(x.minimum_quantity)).slice(0,8),[stockItems]);
  const top=useMemo(()=>{const map=new Map<string,{quantity:number;revenue:number}>();orderItems.forEach(i=>{const c=map.get(i.product_name)??{quantity:0,revenue:0};c.quantity+=Number(i.quantity||0);c.revenue+=Number(i.line_total||0);map.set(i.product_name,c)});return Array.from(map.entries()).map(([name,v])=>({name,...v})).sort((a,b)=>b.revenue-a.revenue).slice(0,5)},[orderItems]);
  const openTableCount=openOrders.filter(x=>x.order_type==="Masa").length;
  const waitingCount=openOrders.filter(x=>x.order_type!=="Masa").length;

  return <main className="min-h-screen bg-[#f4efe5] px-4 py-5 text-[#292821] md:px-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-col gap-4 border-b border-[#6e1f12]/15 pb-5 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-bold text-[#6e1f12]" style={{fontFamily:BRAND_FONT}}>Leman&apos;s Deli Dashboard</h1><p className="mt-1 text-sm opacity-50">Bugünkü satış, açık adisyon ve kritik stok özeti</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void loadDashboard()} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Yenile</button><a href="/pos/report" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Raporlar</a><a href="/pos" className="rounded-xl bg-[#6e1f12] px-4 py-2 text-sm font-semibold text-white">POS&apos;a Dön</a></div></header>
    {loading?<div className="rounded-3xl bg-white p-10 text-center">Dashboard yükleniyor...</div>:<>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Card label="Bugünkü Ciro" value={`${money(summary.revenue)} ₺`}/><Card label="Adisyon" value={String(summary.orderCount)}/><Card label="Ortalama" value={`${money(average)} ₺`}/><Card label="Açık Masa" value={String(openTableCount)}/><Card label="Bekleyen" value={String(waitingCount)}/><Card label="Kritik Stok" value={String(critical.length)}/></section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2"><Panel title="Sipariş Dağılımı"><Metric label="Masa" value={`${summary.tableOrders} adisyon`}/><Metric label="Paket" value={`${summary.packageOrders} adisyon`}/><Metric label="Gel-Al" value={`${summary.pickupOrders} adisyon`}/><Metric label="İkram / İç Tüketim" value={`${money(summary.internal)} ₺`} strong/></Panel><Panel title="Kritik Stoklar">{critical.length?critical.map(i=><Metric key={i.id} label={i.name} value={`${qty(i.current_quantity)} ${i.unit}`} danger/>):<p className="rounded-xl bg-green-50 px-4 py-5 text-center text-sm text-green-800">Kritik stok bulunmuyor.</p>}<a href="/pos/stock" className="mt-2 block rounded-xl border px-4 py-3 text-center text-sm font-semibold text-[#6e1f12]">Stok Yönetimine Git</a></Panel></section>
      <section className="mt-5 rounded-3xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-[#6e1f12]" style={{fontFamily:BRAND_FONT}}>Bugünün En Çok Satanları</h2><a href="/pos/report" className="text-sm font-semibold text-[#6e1f12]">Ayrıntılı Rapor</a></div>{top.length?<div className="mt-4 divide-y">{top.map((p,i)=><div key={p.name} className="grid gap-3 py-4 sm:grid-cols-[60px_1fr_auto_auto] sm:items-center"><p className="text-lg font-bold text-[#6e1f12]">#{i+1}</p><p className="font-semibold">{p.name}</p><p className="text-sm opacity-55">{qty(p.quantity)} satış</p><p className="font-bold">{money(p.revenue)} ₺</p></div>)}</div>:<p className="mt-4 rounded-xl bg-[#f4efe5] px-4 py-6 text-center text-sm opacity-50">Bugün henüz satış kaydı yok.</p>}</section>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Quick href="/pos/orders" title="Kapanan Adisyonlar" text="Geçmiş işlemler ve tekrar yazdırma"/><Quick href="/pos/stock" title="Stok" text="Stok kartları ve hareketler"/><Quick href="/pos/recipes" title="Reçeteler" text="Ürün maliyeti ve stok kullanımı"/><Quick href="/pos/stock/link" title="Stok Bağlantıları" text="Menü ürünü ile stok eşleştirme"/></section>
    </>}
  </div></main>
}

function Card({label,value}:{label:string;value:string}){return <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase tracking-wide opacity-45">{label}</p><p className="mt-2 text-xl font-bold text-[#6e1f12]">{value}</p></div>}
function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
})
{return <section className="rounded-3xl border bg-white p-5"><h2 className="text-xl font-bold text-[#6e1f12]" style={{fontFamily:BRAND_FONT}}>{title}</h2><div className="mt-4 space-y-3">{children}</div></section>}
function Metric({label,value,strong=false,danger=false}:{label:string;value:string;strong?:boolean;danger?:boolean}){return <div className={`flex items-center justify-between gap-4 rounded-xl px-3 py-3 ${danger?"bg-red-50 text-red-800":strong?"bg-[#f4efe5] font-bold":"bg-black/[0.025]"}`}><span>{label}</span><span className="text-right font-semibold">{value}</span></div>}
function Quick({href,title,text}:{href:string;title:string;text:string}){return <a href={href} className="rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5"><p className="font-bold text-[#6e1f12]" style={{fontFamily:BRAND_FONT}}>{title}</p><p className="mt-2 text-sm leading-5 opacity-50">{text}</p></a>}