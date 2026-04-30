export type TemplateAsset = {
  type: 'image' | 'video';
  src: string; // bucket-relative filename, e.g. "fashion_template.png"
  label: string;
};

export type ContentTemplate = {
  id: string;
  title: string;
  category: 'Launch' | 'UGC' | 'Editorial' | 'Performance';
  vibe: string;
  description: string;
  hooks: string[];
  imagePrompt: string;
  videoPrompt: string;
  animationPrompt: string;
  assets?: TemplateAsset[];
};

export const contentTemplates: ContentTemplate[] = [
  {
    id: 'fashion',
    title: 'Fashion Editorial',
    category: 'Editorial',
    vibe: 'High-end, industrial golden hour',
    description: 'Cinematic full-body portraits set in industrial landscapes, contrasting ornate textiles with weathered urban environments.',
    hooks: [
      'Contrast rich textures with industrial grit.',
      'Utilize golden hour light for dramatic, sharp shadows.',
      'Maintain a composed, high-fashion direct gaze.',
    ],
    imagePrompt:
      'A full-body, centered portrait photograph of a young East Asian male model with a composed, direct gaze. He stands on a red and white striped asphalt track wearing a prominent red knit varsity cardigan with "GPT" text. Suspended directly behind him is a massive, ornate, light gold Persian-style tapestry. Set in an industrial port area during golden hour. Strong, low-angled golden sunlight, rich filmic quality, high-end editorial finish.',
    videoPrompt:
      'High-end fashion editorial video. 0-4s: Slow tracking shot of a model in a red varsity cardigan on a striped track at an industrial port. 4-8s: The model stands motionless with a direct gaze while the massive ornate tapestry behind him ripples in the breeze. 8-12s: Extreme close-ups of textile patterns and industrial machinery under golden hour light. Rich filmic colors and deep shadows.',
    animationPrompt:
      'A refined looping animation where the suspended tapestry behind the model waves gently while golden sunlight shimmers across the industrial port landscape.',
    assets: [{ type: 'image', src: 'fashion_template.png', label: 'Fashion Editorial' }],
  },
  {
    id: 'magazine',
    title: 'Vintage Editorial',
    category: 'Editorial',
    vibe: 'Vintage offset-print, textured art paper',
    description: 'A distressed, low-fidelity vintage art paper poster style with meticulous illustrations and dense serif typography.',
    hooks: [
      'Use a distressed, low-fidelity offset-print aesthetic.',
      'Balance dense serif text blocks with high-contrast illustrations.',
      'Anchor with a prominent heading and distinct logo emblem.',
    ],
    imagePrompt:
      'A vintage, textured cream-colored art paper poster with a distressed, low-fidelity offset-print style. Top center features large bold serif typography and a square logo emblem. The center features a meticulously detailed illustration in high-contrast tones: a happy reddish-tan dog on a modern lounge chair with deep blue cushions and a curved chrome frame. Multiple columns of dense serif body text below. Aged print aesthetic, rich saturated colors, deep textured shadows.',
    videoPrompt:
      'A vintage editorial video in a low-fidelity offset-print style. 0-4s: A textured cream paper poster unfolds to reveal bold serif headings and dense text columns. 4-8s: Close-ups of the distressed ink and high-contrast illustration of the dog on the blue lounge chair. 8-12s: Smooth camera movement over the aged print details. Rich saturated colors and filmic shadows.',
    animationPrompt:
      'A looping animation with subtle art-paper texture jitter, ink-bleed effects on the typography, and a slow zoom on the high-contrast centerpiece illustration.',
    assets: [{ type: 'image', src: 'magazine_template.png', label: 'Magazine Spread' }],
  },
  {
    id: 'movie-poster',
    title: 'Creative Box POV',
    category: 'Launch',
    vibe: 'Clever, humorous, disruptive',
    description: 'A unique first-person POV from inside a corrugated box, creating a natural frame for humorous visual hooks and bold, modern typography.',
    hooks: [
      'Use the converging lines of the box walls to frame the visual hook.',
      'Leverage the expansive interior surfaces for massive, bold typography.',
      'Contrast warm earthy interior tones with brilliant, saturated exterior light.',
    ],
    imagePrompt:
      'A clever and humorous advertising poster from a first-person POV looking straight up from inside a corrugated cardboard box. Two inquisitive black-and-white cows peer down into the box against a brilliant blue sky with fluffy clouds. Massive bold dark grey sans-serif headline on the interior wall. Playful, disruptive, and highly polished aesthetic, 2:3.',
    videoPrompt:
      'Clever POV commercial. 0-4s: Smooth camera move looking up from inside a box as flaps open to reveal a bright blue sky. 4-8s: Two curious cows peer in with inquisitive expressions. 8-12s: Bold typography reveals itself on the box wall as the scene transitions to a minimalist brand logo. Playful, polished, and disruptive pacing.',
    animationPrompt:
      'A playful looping animation from inside a box where curious subjects peek in and out of the opening against a shimmering blue sky.',
    assets: [{ type: 'image', src: 'movie_poster_template.png', label: 'Movie Poster' }],
  },
  {
    id: 'y2k-poster',
    title: 'Y2K Streetwear',
    category: 'Performance',
    vibe: 'Vibrant Y2K, loud graphic-driven',
    description: 'An energetic Y2K-inspired streetwear aesthetic featuring bold 3D typography, star-sticker overlays, and high-contrast blue and yellow tones.',
    hooks: [
      'Lead with massive, cartoonish 3D block lettering.',
      'Utilize sticker-like overlays and "tape-affixed" graphics.',
      'Contrast deep blue gradients with bright yellow accents.',
    ],
    imagePrompt:
      'A vibrant, Y2K-inspired streetwear promotional poster set against a rich, deep blue gradient background. Top features massive cartoonish 3D block letters in bright yellow. Central focus is a portrait of a young person in a dark oversized hoodie holding a red lollipop. Floating sticker-like overlays of yellow stars and smiley faces. Bold yellow headlines, italicized white body text, and a pill-shaped CTA button. Loud, energetic, and heavily graphic-driven.',
    videoPrompt:
      'Loud, energetic Y2K streetwear commercial. 0-3s: Rapid flashes of star-sticker graphics and smiley faces over deep blue. 3-6s: Kinetic typography reveal with massive 3D yellow block letters. 6-9s: Portrait of a person in a hoodie with a red lollipop, posing confidently. 9-12s: Dynamic graphic collage with a bright yellow pill-shaped CTA. Fast, high-energy pacing.',
    animationPrompt:
      'A vibrant looping animation with floating yellow star stickers, bouncing 3D block letters, and a rotating smiley face graphic on a deep blue gradient background.',
    assets: [{ type: 'image', src: 'y2k_poster_template.jpg', label: 'Y2K Poster' }],
  },
  {
    id: 'hyper-motion',
    title: 'Hyper Motion',
    category: 'Performance',
    vibe: 'High-energy, Japanese Kawaii-Pop',
    description: 'Vibrant, fast-paced commercial style with tactile textures, playful mascot animations, and maximum visual energy.',
    hooks: [
      'Start with a tactile macro crunch.',
      'Use rapid cuts of shared joy and passing product.',
      'Incorporate playful 2D character overlays.',
    ],
    imagePrompt:
      'High-energy product hero shot in a Japanese pop-art style, vibrant colors, floating chocolate pieces with motion blur, cute 2D chibi mascot character in corner, 9:16.',
    videoPrompt:
      'High-energy Japanese chocolate-style commercial. 0-3s: Macro shots of [PRODUCT] breaking with a satisfying crunch texture. 3-6s: Rapid cuts of hands passing [PRODUCT] between smiling friends. 6-9s: Playful 2D chibi animated characters dancing around the product. 9-12s: Final hero shot with vibrant typography and colorful flavor particles. Audio: Hyper-pop with exaggerated foley crunches.',
    animationPrompt:
      'A hyper-vibrant looping animation with 2D mascots jumping over [PRODUCT] and floating flavor icons.',
    assets: [{ type: 'video', src: 'hyper_motion_template.mp4', label: 'Hyper Motion' }],
  },
  {
    id: 'mock',
    title: 'Luxury Cinematic',
    category: 'Launch',
    vibe: 'Sleek, high-end 3D render',
    description: 'A sophisticated luxury commercial style mimicking photorealistic 3D studio renders with extreme macro focus and premium material textures.',
    hooks: [
      'Use slow-motion orbital rotations to highlight contours.',
      'Contrast elemental backgrounds like silk and golden sand.',
      'Utilize dynamic light sweeps to create glowing reflections.',
    ],
    imagePrompt:
      'A photorealistic luxury product shot mimicking a high-end 3D studio render. Extreme macro details on material finishes. Product resting gracefully on undulating rich silk fabrics with warm, dramatic studio lighting. Deep burgundies, golds, and warm ambers. Sophisticated, sleek, premium quality, 4k, 1:1.',
    videoPrompt:
      'Highly cinematic luxury commercial. Smooth, elegant camera work with slow-motion sweeping pans and orbital rotations. Extreme close-ups highlight material textures. Product transitions from undulating silk to fine golden blowing sand. Dramatic warm lighting sweeps across the surface creating glowing reflections. Rich gold, copper, and amber tones. Perfectly smooth, rhythmic motion.',
    animationPrompt:
      'A sophisticated looping animation with fluid light sweeps over premium textures, shimmering golden reflections, and slow, rhythmic orbital motion around the product.',
    assets: [{ type: 'video', src: 'mock_template.mp4', label: 'Product Mockup' }],
  },
  {
    id: 'tutorial',
    title: 'Tutorial / How-To',
    category: 'UGC',
    vibe: 'Authentic, creator-led UGC',
    description: 'Amateur-style product demonstration in a real-life setting, building trust through genuine reactions.',
    hooks: [
      'Open with a visceral visual hook.',
      'Show the product texture and application in close-up.',
      'End with an honest, conversational endorsement.',
    ],
    imagePrompt:
      'Authentic amateur UGC image in a bright bathroom, handheld smartphone look, girl holding [PRODUCT] next to her face, soft natural daylight, white tiles, real-life details, 9:16.',
    videoPrompt:
      'Authentic amateur UGC in a bright bathroom (white tiles, natural daylight). Handheld smartphone look. 0-2s: Visual hook of leaning in with surprised eyes. 2-4s: Quick cut, holding [PRODUCT] to cheek, turning it to catch the light: "I literally cannot believe how good this is." 4-7s: Tight close-up of hands applying [PRODUCT] to skin: "Look how it just melts in—my skin already feels insane." 7-10s: Medium shot showing the glow: "Okay, I\'m obsessed. I\'m not going back." 10-12s: Final close-up holding [PRODUCT] with a genuine smile. Audio: Natural conversational voiceover + room tone, no music.',
    animationPrompt:
      'A refined looping animation showing a close-up of [PRODUCT] being held by hand with a soft natural light sweep.',
    assets: [{ type: 'video', src: 'tutorial_template.mp4', label: 'Tutorial / How-To' }],
  },
  {
    id: 'unboxing',
    title: 'Aesthetic Unboxing',
    category: 'UGC',
    vibe: 'Aesthetic lifestyle, authentic UGC',
    description: 'A fast-paced first-person unboxing experience set in a curated lifestyle environment, using rhythmic cuts and natural daylight.',
    hooks: [
      'Lead with the physical impact of the shipping box hitting the desk.',
      'Use snappy, rhythmic jump cuts to show the unboxing action.',
      'Finish with a hand-held hero shot against a cozy lifestyle background.',
    ],
    imagePrompt:
      'A bright aesthetic lifestyle product shot from a first-person POV. Product held by a single hand against a clean white marble desk with plants and stationery. Soft natural daylight, light and airy color palette, warm pastels, 4:5.',
    videoPrompt:
      'Casual fast-paced aesthetic unboxing from a first-person POV. 0-2s: Cardboard box slides onto a marble desk. 2-5s: Snappy macro cuts of hands slicing tape and opening flaps. 5-8s: Reveal of the pristine product being pulled out. 8-12s: Hand holds product against a cozy background of plants and soft lamps, ending with a close-up of the label. Handheld smartphone feel, snappy jump cuts, natural daylight.',
    animationPrompt:
      'A cozy looping animation showing a hand lifting the product from an open cardboard box on a bright, aesthetic desk with a warm sunlight shimmer.',
    assets: [{ type: 'video', src: 'unboxing_template.mp4', label: 'Unboxing' }],
  },
  {
    id: 'sport',
    title: 'Sport / Performance',
    category: 'Performance',
    vibe: 'Intense, cinematic, high-energy',
    description: 'A gritty, high-contrast sports commercial style focused on effort, sweat, and raw determination.',
    hooks: [
      'Lead with a tactile close-up of preparation (tightening gloves, laces).',
      'Use aggressive fast-cuts for high-intensity movements.',
      'End with a powerful, confident stance of achievement.',
    ],
    imagePrompt:
      'A high-contrast cinematic sport photography shot, intense gym lighting, dramatic shadows, beads of sweat on skin, raw determination, powerful composition, ultra-realistic textures, 9:16.',
    videoPrompt:
      'High-energy cinematic promotional video. Close-up of hands tightening gym gloves, sweat dripping, shoes hitting the gym floor. Fast cuts of intense workout movements, heavy breathing, determination. Slow motion shots of lifting, jumping, running. Powerful facial expressions. Final shot: confident stance after workout. Dynamic handheld mixed with slow motion. High contrast gym lighting, dramatic shadows. Fast, aggressive pacing.',
    animationPrompt:
      'A powerful looping animation with pulsing cinematic lights, motion trails on fast workout movements, and a gritty texture overlay.',
    assets: [{ type: 'video', src: 'sport_template.mp4', label: 'Sport / Performance' }],
  },
  {
    id: 'learning',
    title: 'Educational / Study',
    category: 'UGC',
    vibe: 'Modern, relatable, uplifting',
    description: 'A relatable student-focused story showing the transition from chaotic study sessions to calm, organized focus.',
    hooks: [
      'Open with the relatable chaos of exam preparation.',
      'Visualize the instant "magic" of organization and clarity.',
      'End with a feeling of confidence and academic success.',
    ],
    imagePrompt:
      'A modern cinematic portrait of a student at a clean, organized desk, soft natural daylight, shallow depth of field, feeling focused and confident, headphones on, high-end editorial finish, ultra-realistic, 9:16.',
    videoPrompt:
      'Relatable cinematic promotional video. A student desk cluttered with notebooks and a laptop full of tabs. Student looks overwhelmed. They open an app: instantly, notes organize, key points highlight, summaries appear clean. Desk becomes tidy, student relaxed and focused, studying confidently with headphones. Close-up portrait framing, realistic handheld feel. Soft desk lamp transitioning to bright daylight. Engaging, hopeful pacing.',
    animationPrompt:
      'A smooth looping animation where scattered digital notes and browser tabs fly into a clean, structured list on a glowing screen.',
    assets: [{ type: 'video', src: 'learning_template.mp4', label: 'Educational / Study' }],
  },
  {
    id: 'coffee',
    title: 'Cozy Morning / Coffee',
    category: 'Editorial',
    vibe: 'Warm, peaceful, aesthetic',
    description: 'A slow-paced, atmospheric morning routine focused on sensory details and quiet reflection.',
    hooks: [
      'Lead with the sensory appeal of rising steam and pouring coffee.',
      'Capture the peaceful silence of an early morning routine.',
      'End with a moment of genuine, quiet joy.',
    ],
    imagePrompt:
      'A warm cinematic lifestyle shot of coffee in a ceramic mug, steam rising beautifully, early morning sunrise light through a window, soft shadows, cozy kitchen setting, shallow depth of field, ultra-realistic textures, 9:16.',
    videoPrompt:
      'Warm cinematic promotional video. A cozy kitchen in early morning light. Coffee being poured slowly into a ceramic mug, steam rising beautifully. Close-up of hands holding the warm cup near a window while sunlight fills the room. Peaceful morning routine, calm breathing. A person journaling, smiling gently, enjoying the first sip. Macro close-ups, slow gentle movement. Warm sunrise light.',
    animationPrompt:
      'A calm looping animation with steam rising gracefully from a coffee mug in the warm, shimmering glow of a sunrise.',
    assets: [{ type: 'video', src: 'coffee_template.mp4', label: 'Cozy Morning / Coffee' }],
  },
  {
    id: 'clean-product',
    title: 'Clean Minimalist',
    category: 'Editorial',
    vibe: 'Serene, organic, high-end',
    description: 'A luxurious minimalist aesthetic focusing on organic textures like stone and linen, bathed in warm, geometric morning light.',
    hooks: [
      'Contrast frosted glass and gold with raw travertine stone.',
      'Use strong natural light to cast sharp, architectural shadows.',
      'Maintain a monochromatic neutral palette for a pure, calming feel.',
    ],
    imagePrompt:
      'A highly aesthetic, serene, and luxurious editorial photograph of minimalist skincare. Frosted glass dropper bottle with gold collar and matching open jar on a thick beige travertine stone slab resting on a white ceramic bathtub. Monochromatic warm neutral palette (cream, beige, soft gold). Strong, warm, direct natural morning sunlight casting sharp geometric shadows. Organic, high-end, and pure, 8k resolution.',
    videoPrompt:
      'Serene luxury product commercial. 0-4s: Slow pan across a travertine stone slab resting on a bathtub edge, revealing frosted glass skincare bottles. 4-8s: Macro shots of the gold collar catching the morning sun and the rich texture of the cream. 8-12s: Soft movement of sheer linen curtains in the background as sunlight casts sharp shadows over the scene. Organic, calming, and high-end motion.',
    animationPrompt:
      'A calm looping animation with warm morning sunlight shimmering across frosted glass bottles and organic stone textures, while sheer linen curtains move gently in the background.',
    assets: [{ type: 'image', src: 'clean_product_template.jpeg', label: 'Clean Minimalist' }],
  },
];
