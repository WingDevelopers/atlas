/**
 * Illustrated postcard landscapes in the Sunlit Wanderlust palette.
 * Used as a gentle placeholder when an entry has no photo yet.
 * They're clearly illustrations — never presented as real photos.
 */

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

const SCENES = ['coast', 'hills', 'mountains', 'dunes'] as const
export type Scene = (typeof SCENES)[number]

export function sceneFor(seed: string): Scene {
  return SCENES[hash(seed) % SCENES.length]
}

export function Art({ seed = 'atlas', scene, className = 'art' }: { seed?: string; scene?: Scene; className?: string }) {
  const s = scene ?? sceneFor(seed)
  const id = `g${hash(seed + s) % 100000}`
  return (
    <svg className={className} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s === 'dunes' ? '#FFD27A' : '#B5E6E1'} />
          <stop offset="0.65" stopColor={s === 'mountains' ? '#FFE9DE' : '#FFF3DC'} />
          <stop offset="1" stopColor="#FFF9ED" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}sky)`} />
      <circle cx={s === 'coast' ? 290 : s === 'dunes' ? 110 : 270} cy={s === 'mountains' ? 95 : 120} r="44" fill="#FFC857" opacity="0.95" />
      {s === 'coast' && (
        <>
          <path d="M0 175 Q100 160 200 172 T400 168 V300 H0z" fill="#37B9B0" />
          <path d="M0 200 Q120 188 240 200 T400 196 V300 H0z" fill="#23968E" opacity="0.6" />
          <path d="M0 236 Q140 214 260 238 T400 230 V300 H0z" fill="#FBE6BF" />
          <path d="M0 262 Q160 246 300 266 T400 260 V300 H0z" fill="#F5D69E" />
          <path d="M40 120 l6 3 M62 108 l6 3" stroke="#275C55" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        </>
      )}
      {s === 'hills' && (
        <>
          <path d="M0 190 Q90 140 180 180 T400 160 V300 H0z" fill="#A6DDD3" />
          <path d="M0 220 Q120 175 250 215 T400 200 V300 H0z" fill="#3FAFA2" />
          <path d="M0 255 Q140 225 280 255 T400 245 V300 H0z" fill="#FF775E" opacity="0.85" />
          <path d="M0 280 Q160 262 320 282 T400 278 V300 H0z" fill="#E8604A" opacity="0.6" />
        </>
      )}
      {s === 'mountains' && (
        <>
          <path d="M0 210 L80 120 L140 180 L220 90 L300 190 L350 150 L400 190 V300 H0z" fill="#37B9B0" opacity="0.75" />
          <path d="M220 90 L248 124 L232 120 L220 132 L206 118 L194 124z" fill="#FFF9ED" opacity="0.95" />
          <path d="M0 240 L110 170 L190 230 L270 175 L400 245 V300 H0z" fill="#275C55" opacity="0.82" />
          <path d="M0 270 Q200 248 400 272 V300 H0z" fill="#A6DDD3" />
        </>
      )}
      {s === 'dunes' && (
        <>
          <path d="M0 200 Q110 150 220 196 T400 182 V300 H0z" fill="#FFC857" opacity="0.8" />
          <path d="M0 230 Q150 185 290 232 T400 220 V300 H0z" fill="#FF775E" opacity="0.85" />
          <path d="M0 265 Q170 232 330 268 T400 262 V300 H0z" fill="#E8604A" opacity="0.75" />
          <path d="M318 196 v-30 M318 176 q-12 -6 -14 -16 M318 182 q12 -6 14 -18" stroke="#275C55" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
        </>
      )}
    </svg>
  )
}

/** Small illustration used in empty states. */
export function EmptyArt() {
  return (
    <svg className="art" viewBox="0 0 120 84" aria-hidden>
      <rect x="8" y="10" width="104" height="66" rx="8" fill="#FFFDF8" stroke="#275C55" strokeOpacity=".2" />
      <circle cx="82" cy="34" r="10" fill="#FFC857" />
      <path d="M8 62 Q40 44 64 58 T112 52 V68 a8 8 0 0 1 -8 8 H16 a8 8 0 0 1 -8 -8z" fill="#37B9B0" opacity=".85" />
      <path d="M20 26 h26 M20 34 h18" stroke="#FF775E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
