import React, { useEffect, useRef } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';

const GamePage: NextPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (gameRef.current) return;
    import('../lib/game/game').then(({ createGame }) => {
      if (containerRef.current && !gameRef.current) {
        gameRef.current = createGame(containerRef.current);
      }
    });
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <Head>
        <title>久条高校 — Kujou High School</title>
        <meta name="description" content="2D pixel art action game" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{
        margin:0,padding:0,width:'100vw',height:'100vh',
        background:'#0a0a1a',display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',overflow:'hidden',fontFamily:'monospace'
      }}>
        <div ref={containerRef} style={{width:'800px',maxWidth:'100vw',imageRendering:'pixelated'}} />
        <div style={{marginTop:'8px',color:'#443366',fontSize:'11px',letterSpacing:'1px',textAlign:'center'}}>
          ←→ MOVE &nbsp;|&nbsp; SPACE JUMP &nbsp;|&nbsp; SHIFT DASH &nbsp;|&nbsp; Z ATTACK &nbsp;|&nbsp; X GUARD &nbsp;|&nbsp; C FINISHER &nbsp;|&nbsp; F1 DEBUG
        </div>
      </main>
      <style>{`* { box-sizing:border-box;margin:0;padding:0; } body{background:#0a0a1a;overflow:hidden;} canvas{image-rendering:pixelated;display:block;}`}</style>
    </>
  );
};
export default GamePage;
