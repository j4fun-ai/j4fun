import { ArrowRight, ArrowUpRight, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const repositoryUrl = "https://github.com/TapXWorld/ChinaTextbook";
const j4funHomeUrl = import.meta.env.BASE_URL.replace(/shiben\/?$/, "") || "/";
const imagePath = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

const stages = [
  { label: "小学", subtitle: "一至六年级", path: "小学", description: "语文、数学、英语及其他学科教材" },
  { label: "初中", subtitle: "七至九年级", path: "初中", description: "按学科、年级和教材版本查找" },
  { label: "高中", subtitle: "十至十二年级", path: "高中", description: "高中各学科教材与课程资料" },
  { label: "大学", subtitle: "大学课程", path: "大学", description: "高等数学等大学课程资料" },
];

const browseHref = (path: string) => `/browse?path=${encodeURIComponent(path)}`;

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-[#172f39]">
      <header className="sticky top-0 z-50 border-b border-[#17303b]/10 bg-[#f7f2e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#top" className="group flex items-center gap-3" aria-label="识本首页">
            <img src={imagePath("huawen-textbook-mark.svg")} alt="" className="h-12 w-12 rounded-full border-2 border-[#167b78]/25 bg-[#d7ebe5] p-1.5 object-contain transition-transform duration-200 group-hover:-rotate-3" />
            <span className="leading-none"><span className="block font-serif text-[19px] font-semibold tracking-[0.16em]">识本</span><span className="mt-1 block text-xs font-semibold tracking-[0.14em] text-[#167b78]">华文教材库</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex" aria-label="主导航">
            <a className="nav-link" href="#catalog">教材目录</a>
            <a className="nav-link" href={j4funHomeUrl}>J4FUN 出品</a>
          </nav>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#17303b]/15 bg-white/70 md:hidden" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "关闭导航" : "打开导航"} aria-expanded={mobileOpen}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {mobileOpen && <nav className="border-t border-[#17303b]/10 bg-[#f7f2e8] px-5 py-4 md:hidden" aria-label="移动端主导航">
          {[["教材目录", "#catalog"], ["J4FUN 出品", j4funHomeUrl]].map(([label, href]) => <a key={label} href={href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 font-medium hover:bg-white/70">{label}<ChevronRight size={17} /></a>)}
        </nav>}
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 lg:py-20">
          <div className="max-w-xl">
            <p className="eyebrow text-[#167b78]">给海外华人家庭的教材导览</p>
            <h1 className="mt-5 font-serif text-[clamp(3rem,6vw,5.6rem)] font-semibold leading-[1.02] tracking-[-0.055em]">按学段找<br /><span className="text-[#167b78]">国内教材。</span></h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-[#3d5359] sm:text-lg">选择小学、初中、高中或大学，再按学科和版本继续查找。PDF 可以直接在本站打开。</p>
            <a href="#catalog" className="action-button mt-8 bg-[#167b78] text-white hover:bg-[#0e6562]">选择学段 <ArrowRight size={18} /></a>
          </div>
          <div className="overflow-hidden rounded-[28px] bg-[#ebe1cd] shadow-[0_28px_70px_-42px_rgba(25,47,57,0.5)]"><img src={imagePath("huawen-textbook-hero.svg")} alt="家长与孩子一起阅读中文教材" className="aspect-[5/4] h-full w-full object-cover" /></div>
        </section>

        <section id="catalog" className="scroll-mt-24 bg-[#172f39] px-5 py-14 text-[#f7f2e8] sm:px-8 sm:py-18 lg:px-12 lg:py-20">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow text-[#79c4b8]">教材主目录</p><h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">选择学段，直接进入</h2></div><p className="max-w-md text-sm leading-6 text-[#b7c6c3]">进入后可继续选择学科、年级和教材版本。</p></div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stages.map((stage, index) => <Link key={stage.path} href={browseHref(stage.path)} className="group flex min-h-56 flex-col justify-between border border-[#79c4b8]/30 bg-white/[0.05] p-6 transition hover:-translate-y-1 hover:border-[#79c4b8] hover:bg-white/[0.09]">
                <span className="text-sm text-white/45">0{index + 1}</span>
                <span><span className="block font-serif text-3xl font-semibold">{stage.label}</span><span className="mt-1 block text-xs text-[#79c4b8]">{stage.subtitle}</span><span className="mt-4 block text-sm leading-6 text-[#c7d2cf]">{stage.description}</span></span>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#b6eee4]">打开目录 <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
              </Link>)}
            </div>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 border-l-2 border-[#167b78] bg-white/40 p-6 sm:flex-row sm:items-center sm:p-8"><div><h2 className="font-serif text-2xl font-semibold">资料来源</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#53686b]">识本是一个基于 TapXWorld/ChinaTextbook 开源资源制作的华文教材在线浏览器。</p></div><a href={repositoryUrl} target="_blank" rel="noreferrer" className="action-button shrink-0 border border-[#17303b]/15 bg-white text-[#172f39] hover:border-[#167b78] hover:text-[#167b78]">查看原始仓库 <ArrowUpRight size={17} /></a></div></section>
      </main>

      <footer className="bg-[#172f39] px-5 py-8 text-[#c7d2cf] sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-5 text-center text-sm sm:flex-row sm:text-left"><div className="flex items-center gap-3"><img src={imagePath("huawen-textbook-mark.svg")} alt="" className="h-8 w-8" /><span>识本 · 华文教材库</span></div><div className="leading-relaxed text-[#9bafae] sm:text-right"><a className="font-semibold tracking-[0.08em] hover:text-white" href={j4funHomeUrl}>© 2026 J4FUN</a><span className="block text-xs">Made with ❤️ (AI)</span></div></div></footer>
    </div>
  );
}
