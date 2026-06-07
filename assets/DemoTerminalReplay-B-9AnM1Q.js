import{j as t,r as c,x as k,d as D,a as T,b as O,c as R}from"./index-BHpeeDZJ.js";const C="demo-ws";new Date().toISOString(),new Date().toISOString();new Date().toISOString();new Date().toISOString(),new Date().toISOString();new Date().toISOString();function z({label:r}){return t.jsx("div",{className:"flex h-full w-full items-center justify-center bg-zinc-950 p-8 text-zinc-400",children:t.jsxs("div",{className:"max-w-md text-left space-y-3",children:[t.jsx("div",{className:"font-mono text-[11px] uppercase tracking-wider text-zinc-500",children:r}),t.jsx("div",{className:"text-base font-semibold text-zinc-200",children:"Agent terminal"}),t.jsxs("div",{className:"text-sm leading-relaxed text-zinc-400",children:["In a real OpenAlice install, this pane is a live PTY running"," ",t.jsx("span",{className:"text-zinc-300",children:"Claude Code"}),","," ",t.jsx("span",{className:"text-zinc-300",children:"Codex"}),", or"," ",t.jsx("span",{className:"text-zinc-300",children:"shell"})," — the AI agent drives it directly: reads files, runs commands, reports back."]}),t.jsx("div",{className:"text-xs text-zinc-500",children:"Demo mode shows the workspace structure without a live process."}),t.jsx("div",{className:"pt-2",children:t.jsx("a",{href:"https://github.com/TraderAlice/OpenAlice",target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:underline",children:"Install OpenAlice locally →"})})]})})}const E=new TextEncoder;function F(r){const n=E.encode(r);let s="";for(let a=0;a<n.length;a++)s+=String.fromCharCode(n[a]);return btoa(s)}const A=[];let b=0;function e(r,n){b+=r,A.push({atMs:b,bytesB64:F(n)})}function M(r,n=30){for(const s of r)e(n,s)}e(0,"\x1B[2J\x1B[H");e(80,`\x1B[1;36m╭───────────────────────────────╮\x1B[0m\r
`);e(40,`\x1B[1;36m│\x1B[0m  \x1B[1mClaude Code\x1B[0m \x1B[2m· workspace aapl-q1\x1B[0m  \x1B[1;36m│\x1B[0m\r
`);e(40,`\x1B[1;36m╰───────────────────────────────╯\x1B[0m\r
`);e(600,`\r
`);e(0,`Hi! I'm Claude.\r
\r
`);e(1200,"\x1B[1;32m❯\x1B[0m ");e(700,"");M("hey, what jumped out from Apple's Q1 earnings?");e(400,`\r
\r
`);e(600,`\x1B[2m▶\x1B[0m Reading \x1B[36mdata/news/aapl-q1-2026.md\x1B[0m\r
`);e(900,`\x1B[2m▶\x1B[0m Reading \x1B[36mdata/sec/aapl/10-Q-Q1-2026.json\x1B[0m\r
`);e(1100,`\x1B[2m▶\x1B[0m Calculating quarterly services revenue YoY...\x1B[0m\r
`);e(1500,`\r
`);e(400,`Something the headline EPS beat is hiding:\r
\r
`);e(700,`  \x1B[2mQ2 FY25:\x1B[0m  services \x1B[33m+16.3%\x1B[0m YoY\r
`);e(80,`  \x1B[2mQ3 FY25:\x1B[0m            \x1B[33m+14.2%\x1B[0m\r
`);e(80,`  \x1B[2mQ4 FY25:\x1B[0m            \x1B[33m+12.0%\x1B[0m\r
`);e(80,`  \x1B[2mQ1 FY26:\x1B[0m            \x1B[1;31m+9.1%\x1B[0m  \x1B[2m← three-quarter deceleration\x1B[0m\r
`);e(800,`\r
`);e(500,`Third consecutive deceleration in services growth.\r
`);e(40,`Services has historically been the margin defender (\x1B[33m~29%\x1B[0m);\r
`);e(40,`if growth slips below \x1B[33m+8%\x1B[0m the \x1B[1mSaaS-like multiple thesis\x1B[0m\r
`);e(40,`breaks down.\r
\r
`);e(900,`Let me write this up properly.\r
\r
`);e(500,`\x1B[2m▶\x1B[0m Writing \x1B[36mresearch-AAPL-q1.md\x1B[0m\r
`);e(1400,`\x1B[2m▶\x1B[0m \x1B[35minbox_push\x1B[0m: \x1B[2m"AAPL Q1 — Hidden Deceleration Signal"\x1B[0m\r
`);e(1100,`\r
`);e(500,`\x1B[32m✓\x1B[0m Done. Report posted to your \x1B[1mInbox\x1B[0m.\r
\r
`);e(800,`Want me to set up a watchlist alert on next quarter's\r
`);e(40,`services number?\r
\r
`);e(400,"\x1B[1;32m❯\x1B[0m ");e(400,"\x1B[5m▁\x1B[0m");const Q={label:"AAPL Q1 research",durationMs:b+500,defaultSpeed:1,frames:A},W={[C]:Q};function L(r){const n=W[r.wsId];return n?t.jsx(Y,{label:r.label,transcript:n},r.sessionId):t.jsx(z,{label:r.label})}function Y({label:r,transcript:n}){const s=c.useRef(null),[a,y]=c.useState(!1),[S,j]=c.useState(0);return c.useEffect(()=>{const i=s.current;if(!i)return;const l=new k.Terminal({theme:D,fontFamily:'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "DejaVu Sans Mono", monospace',fontSize:13,lineHeight:1.2,cursorBlink:!0,allowProposedApi:!0,scrollback:1e4,disableStdin:!0,convertEol:!1}),x=new T.FitAddon;l.loadAddon(x),l.loadAddon(new O.WebLinksAddon),l.open(i);let d=null,u=null,o=0,h=0,B=0,p=!1;const v=n.defaultSpeed??1,g=m=>{if(p)return;h===0&&(h=m);const f=(m-h)*v;for(;o<n.frames.length&&n.frames[o].atMs<=f;)l.write(q(n.frames[o].bytesB64)),o++;o<n.frames.length?B=requestAnimationFrame(g):y(!0)};let w=0;const N=window.setTimeout(function m(){if(p)return;const f=i.clientWidth,I=i.clientHeight;if((f<50||I<30)&&w<40){w++,window.setTimeout(m,25);return}try{d=new R.WebglAddon,l.loadAddon(d)}catch{}try{x.fit()}catch{}u=new ResizeObserver(()=>{try{x.fit()}catch{}}),u.observe(i),B=requestAnimationFrame(g)},0);return()=>{p=!0,window.clearTimeout(N),cancelAnimationFrame(B),u?.disconnect(),d?.dispose(),l.dispose()}},[n,S]),t.jsxs("div",{className:"terminal-shell",children:[t.jsxs("header",{className:"terminal-header",children:[t.jsxs("span",{className:"inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400",children:[t.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"}),"Replay"]}),t.jsx("span",{className:"text-[11px] text-text-muted truncate",children:r}),t.jsx("span",{className:"flex-1"}),a&&t.jsx("button",{type:"button",onClick:()=>j(i=>i+1),className:"text-[11px] text-amber-400 hover:underline",children:"↻ Replay again"})]}),t.jsx("div",{ref:s,className:"terminal-host"})]})}function q(r){const n=atob(r),s=new Uint8Array(n.length);for(let a=0;a<n.length;a++)s[a]=n.charCodeAt(a);return s}export{L as DemoTerminalReplay};
