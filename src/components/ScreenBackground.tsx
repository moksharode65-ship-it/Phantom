'use client'

export function ScreenBackground() {
  return (
    <>
      <div
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(237,180,11,0.05)_0%,transparent_60%),radial-gradient(ellipse_50%_60%_at_100%_100%,rgba(0,212,126,0.04)_0%,transparent_50%),radial-gradient(ellipse_40%_50%_at_0%_80%,rgba(0,153,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-pantom-bg/70 z-[1]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(237,180,11,0.03)_0%,_transparent_50%,_rgba(0,212,126,0.02)_100%)] z-[1]" aria-hidden="true" />
    </>
  )
}