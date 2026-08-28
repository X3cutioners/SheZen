import React from "react";

export interface Avatar { id: string; label: string; svg: React.ReactNode }

export const AVATARS: Avatar[] = [
  { id:"bloom", label:"Bloom", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#F2C4C0"/>
      {[0,72,144,216,288].map((d,i)=><ellipse key={i} cx={30+10*Math.sin(d*Math.PI/180)} cy={30-10*Math.cos(d*Math.PI/180)} rx="5.5" ry="8.5" fill="#A84060" fillOpacity=".72" transform={`rotate(${d} ${30+10*Math.sin(d*Math.PI/180)} ${30-10*Math.cos(d*Math.PI/180)})`}/>)}
      <circle cx="30" cy="30" r="4.5" fill="#7A2839"/>
    </svg>
  )},
  { id:"luna", label:"Luna", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#1E1535"/>
      <path d="M34 17a13 13 0 1 0 0 26 9.5 9.5 0 1 1 0-26z" fill="#B89ED8"/>
      <circle cx="43" cy="16" r="1.8" fill="#DDD0F5"/><circle cx="46" cy="24" r="1.2" fill="#DDD0F5"/><circle cx="39" cy="12" r="1" fill="#DDD0F5"/>
    </svg>
  )},
  { id:"aurora", label:"Aurora", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#FEE9C8"/>
      <circle cx="30" cy="33" r="7.5" fill="#F5A020" fillOpacity=".9"/>
      {[0,45,90,135,180,225,270,315].map((d,i)=><line key={i} x1="30" y1="33" x2={30+15*Math.cos((d-90)*Math.PI/180)} y2={33+15*Math.sin((d-90)*Math.PI/180)} stroke="#F5A020" strokeWidth="2" strokeLinecap="round" opacity=".55"/>)}
      <rect x="11" y="41" width="38" height="2.5" rx="1.25" fill="#E0803A" opacity=".45"/>
    </svg>
  )},
  { id:"marina", label:"Marina", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#C2EEF2"/>
      {[23,30,37].map((y,i)=><path key={i} d={`M11 ${y}Q20.5 ${y-5} 30 ${y}Q39.5 ${y+5} 49 ${y}`} stroke="#1E7A88" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={1-i*.18}/>)}
    </svg>
  )},
  { id:"fern", label:"Fern", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#D0EACF"/>
      <line x1="30" y1="46" x2="30" y2="18" stroke="#2E6030" strokeWidth="2.2" strokeLinecap="round"/>
      {[[-1,28],[1,34],[-1,40]].map(([d,y],i)=><ellipse key={i} cx={30+(d as number)*9} cy={y as number} rx="8" ry="4" fill="#4A8A4A" fillOpacity=".82" transform={`rotate(${(d as number)*-28} ${30+(d as number)*9} ${y})`}/>)}
      <circle cx="30" cy="17" r="3" fill="#4A8A4A" fillOpacity=".7"/>
    </svg>
  )},
  { id:"cosmos", label:"Cosmos", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#EAD8FA"/>
      {([[20,18],[38,15],[44,28],[36,41],[20,43],[12,30]] as [number,number][]).map(([x,y],i,arr)=>(
        <g key={i}><circle cx={x} cy={y} r="2.5" fill="#6A3CAF"/>
          {i<arr.length-1&&<line x1={x} y1={y} x2={arr[i+1][0]} y2={arr[i+1][1]} stroke="#6A3CAF" strokeWidth="1" opacity=".35"/>}
        </g>
      ))}
      <line x1="12" y1="30" x2="20" y2="18" stroke="#6A3CAF" strokeWidth="1" opacity=".35"/>
    </svg>
  )},
  { id:"rain", label:"Rain", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#D2DCE8"/>
      <ellipse cx="30" cy="23" rx="12" ry="6.5" fill="#7A98BC" fillOpacity=".82"/>
      <ellipse cx="22" cy="25" rx="6.5" ry="5" fill="#7A98BC" fillOpacity=".82"/>
      <ellipse cx="38" cy="25" rx="6.5" ry="5" fill="#7A98BC" fillOpacity=".82"/>
      {[22,30,38].map((x,i)=><line key={i} x1={x} y1={33+i} x2={x-2} y2={44+i} stroke="#3A5A7A" strokeWidth="2" strokeLinecap="round" opacity=".65"/>)}
    </svg>
  )},
  { id:"ember", label:"Ember", svg:(
    <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="30" fill="#FDD8C0"/>
      <path d="M30 45C22 41 18 34 20 26c2-4 5-2 5-2C23 18 28 13 30 11c0 0-1 9 3 10 2-4 3-8 3-8 4 6 6 15 2 21 0 0-2-6-6-4 2 6 6 9-2 15z" fill="#D04818" fillOpacity=".82"/>
      <path d="M30 41c-4-3-6-9-4-13 1 2 3 2 3 2-1-4 1-8 1-8 0 0 1 7 4 7-2 6 0 8-4 12z" fill="#F5A018" fillOpacity=".88"/>
    </svg>
  )},
];
