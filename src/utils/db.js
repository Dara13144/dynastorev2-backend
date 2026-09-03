import { supabase, isConfigured } from '../config/supabase.js';
import { ENV } from '../config/env.js';
import crypto from 'crypto';

// Re-export supabase so controllers can import it from db.js
export { supabase };

// In-Memory Dev Store for fallback when Supabase is not connected
const devStore = {
  spinSegments: [
    { id: 'spin-seg-1', label: '5% OFF Coupon', color: '#06b6d4', prize_type: 'COUPON', prize_value: '5', weight: 25, is_active: true, created_at: new Date().toISOString() },
    { id: 'spin-seg-2', label: '$1 Wallet Credit', color: '#8b5cf6', prize_type: 'WALLET', prize_value: '1', weight: 15, is_active: true, created_at: new Date().toISOString() },
    { id: 'spin-seg-3', label: '10% OFF Coupon', color: '#10b981', prize_type: 'COUPON', prize_value: '10', weight: 15, is_active: true, created_at: new Date().toISOString() },
    { id: 'spin-seg-4', label: 'Better Luck Next Time', color: '#334155', prize_type: 'NONE', prize_value: '0', weight: 30, is_active: true, created_at: new Date().toISOString() },
    { id: 'spin-seg-5', label: '$2 Wallet Credit', color: '#f59e0b', prize_type: 'WALLET', prize_value: '2', weight: 10, is_active: true, created_at: new Date().toISOString() },
    { id: 'spin-seg-6', label: 'VIP Gamer Badge', color: '#ec4899', prize_type: 'BADGE', prize_value: 'VIP Gamer', weight: 5, is_active: true, created_at: new Date().toISOString() },
  ],
  spinRecords: [], // { id, user_id, order_id, segment_id, prize_type, prize_value, prize_label, created_at }
  categories: [
    { id: 'c1111111-1111-1111-1111-111111111111', name: 'Action', slug: 'action', description: 'Adrenaline-pumping action, combat, and fast-paced gameplay.', image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80' },
    { id: 'c2222222-2222-2222-2222-222222222222', name: 'Adventure', slug: 'adventure', description: 'Epic quests, exploration, and immersive storytelling.', image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80' },
    { id: 'c3333333-3333-3333-3333-333333333333', name: 'RPG', slug: 'rpg', description: 'Deep role-playing games with rich character progression and lore.', image_url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80' },
    { id: 'c4444444-4444-4444-4444-444444444444', name: 'Racing', slug: 'racing', description: 'High-speed motorsport, track racing, and street drifting.', image_url: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&auto=format&fit=crop&q=80' },
    { id: 'c5555555-5555-5555-5555-555555555555', name: 'Sports', slug: 'sports', description: 'Competitive sports, athletics, football, and esports.', image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80' },
    { id: 'c6666666-6666-6666-6666-666666666666', name: 'Simulation', slug: 'simulation', description: 'Flight, building, sandbox, and life simulators.', image_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80' },
    { id: 'c7777777-7777-7777-7777-777777777777', name: 'Strategy', slug: 'strategy', description: 'Tactical, real-time strategy, and 4X empire builders.', image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80' },
    { id: 'c8888888-8888-8888-8888-888888888888', name: 'Horror', slug: 'horror', description: 'Survival horror, psychological thrillers, and spooky tales.', image_url: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=800&auto=format&fit=crop&q=80' },
    { id: 'c9999999-9999-9999-9999-999999999999', name: 'Minecraft & Sandbox', slug: 'minecraft', description: 'Block building, custom modpacks, shaders, and adventure maps.', image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80' },
    { id: 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'PC Games', slug: 'pc-games', description: 'Top tier standalone PC titles, indie gems, and classics.', image_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80' },
  ],
  products: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      title: 'CyberPulse 2088: Neon Protocol',
      slug: 'cyberpulse-2088-neon-protocol',
      description: 'Enter a dystopian cyberpunk megalopolis as an augmented operative fighting rogue AI syndicates. Features high-octane cyber-gunplay, hacking mechanics, ray-traced neon visuals, and an original synthwave soundtrack.',
      short_description: 'Fast-paced cyberpunk action shooter with cybernetic augmentations and neon graphics.',
      price: 24.99,
      discount_price: 14.99,
      category_id: 'c1111111-1111-1111-1111-111111111111',
      platform: 'PC / Windows',
      version: 'v1.4.2',
      developer: 'NeonBlade Studios',
      publisher: 'DynaPublishing',
      release_date: '2025-11-15',
      cover_image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/cyberpulse_2088_v1.4.2.zip',
      file_name: 'cyberpulse_2088_setup.zip',
      file_size: '4.8 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows 10/11 64-bit',
        processor: 'Intel Core i7-9700K / AMD Ryzen 7 3700X',
        memory: '16 GB RAM',
        graphics: 'NVIDIA RTX 3060 / AMD RX 6700 XT',
        storage: '15 GB SSD'
      },
      created_at: new Date('2025-11-15').toISOString(),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Chronicles of Eldoria: Kingdom Fall',
      slug: 'chronicles-of-eldoria-kingdom-fall',
      description: 'An open-world action RPG set in the sprawling fantasy realm of Eldoria. Master ancient magic, forge legendary relics, defeat colossal dragons, and shape the political destiny of five warring kingdoms.',
      short_description: 'Epic fantasy RPG with open-world exploration, dynamic magic, and dragon battles.',
      price: 39.99,
      discount_price: 29.99,
      category_id: 'c3333333-3333-3333-3333-333333333333',
      platform: 'PC / Windows',
      version: 'v2.0.1',
      developer: 'Mythic Forge Interactive',
      publisher: 'DynaPublishing',
      release_date: '2025-09-20',
      cover_image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/eldoria_kingdom_fall_v2.0.1.zip',
      file_name: 'eldoria_kingdom_fall.zip',
      file_size: '12.4 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i5-10400 / AMD Ryzen 5 3600',
        memory: '16 GB RAM',
        graphics: 'NVIDIA GTX 1660 Super / AMD RX 5600 XT',
        storage: '25 GB SSD'
      },
      created_at: new Date('2025-09-20').toISOString(),
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      title: 'Apex Drift: Tokyo Midnight',
      slug: 'apex-drift-tokyo-midnight',
      description: 'Experience true Japanese street racing culture. Tune custom drift machines, challenge rival touge crews on mount Haruna, and conquer the glowing Shuto Expressway in dynamic rain and night conditions.',
      short_description: 'Hyper-realistic street drift simulation with Japanese tuners and authentic physics.',
      price: 19.99,
      discount_price: 9.99,
      category_id: 'c4444444-4444-4444-4444-444444444444',
      platform: 'PC / Windows',
      version: 'v1.1.0',
      developer: 'Redline Sim Racing',
      publisher: 'Apex Dynamics',
      release_date: '2026-01-10',
      cover_image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/apex_drift_tokyo_v1.1.0.zip',
      file_name: 'apex_drift_tokyo.zip',
      file_size: '8.2 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows 10/11',
        processor: 'Intel Core i5-8400 / AMD Ryzen 5 2600',
        memory: '8 GB RAM',
        graphics: 'NVIDIA GTX 1060 6GB / AMD RX 580',
        storage: '12 GB'
      },
      created_at: new Date('2026-01-10').toISOString(),
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      title: 'VoxelCraft Ultra: RPG Overhaul Modpack',
      slug: 'voxelcraft-ultra-rpg-overhaul',
      description: 'The ultimate sandbox overhaul package including 150+ curated RPG mechanics, custom bosses, magical spellcraft, shaders, and biome expansions ready to install in one click.',
      short_description: 'Complete sandbox overhaul modpack with magic, dragons, dungeons and shaders.',
      price: 9.99,
      discount_price: 4.99,
      category_id: 'c9999999-9999-9999-9999-999999999999',
      platform: 'PC / Java',
      version: 'v3.5.0',
      developer: 'BlockCrafters Guild',
      publisher: 'DynaStore Exclusive',
      release_date: '2026-02-01',
      cover_image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/voxelcraft_ultra_v3.5.zip',
      file_name: 'voxelcraft_ultra_modpack.zip',
      file_size: '1.5 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows/Mac/Linux',
        processor: 'Any modern Quad Core CPU',
        memory: '8 GB RAM (Allocated)',
        graphics: 'OpenGL 4.4 compatible',
        storage: '4 GB'
      },
      created_at: new Date('2026-02-01').toISOString(),
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      title: 'Shadows of Blackwood Manor',
      slug: 'shadows-of-blackwood-manor',
      description: 'First-person psychological survival horror. Investigate an abandoned 19th-century Victorian estate haunted by occult entities. Use vintage photographic equipment to reveal unseen horrors.',
      short_description: 'Terrifying psychological horror game with binaural 3D audio and puzzle solving.',
      price: 14.99,
      discount_price: null,
      category_id: 'c8888888-8888-8888-8888-888888888888',
      platform: 'PC / Windows',
      version: 'v1.0.4',
      developer: 'Nightmare Engine',
      publisher: 'DynaPublishing',
      release_date: '2025-10-31',
      cover_image: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/blackwood_manor_v1.0.4.zip',
      file_name: 'blackwood_manor.zip',
      file_size: '6.1 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows 10 64-bit',
        processor: 'Intel Core i5-6600K',
        memory: '8 GB RAM',
        graphics: 'NVIDIA GTX 1070',
        storage: '10 GB'
      },
      created_at: new Date('2025-10-31').toISOString(),
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      title: 'Stellar Command: Galaxy Fleet',
      slug: 'stellar-command-galaxy-fleet',
      description: 'Grand 4X space strategy. Command armada fleets, establish galactic colonies, research antimatter technologies, and forge diplomatic treaties or total orbital bombardments across 500 star systems.',
      short_description: 'Grand 4X space strategy simulator with massive fleet warfare and planetary management.',
      price: 29.99,
      discount_price: 19.99,
      category_id: 'c7777777-7777-7777-7777-777777777777',
      platform: 'PC / Windows',
      version: 'v1.3.0',
      developer: 'Nova Dynamics',
      publisher: 'Astro Interactive',
      release_date: '2025-12-05',
      cover_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80'
      ],
      file_path: 'games/stellar_command_v1.3.zip',
      file_name: 'stellar_command_fleet.zip',
      file_size: '5.3 GB',
      is_published: true,
      system_requirements: {
        os: 'Windows 10/11 64-bit',
        processor: 'Intel Core i7 / AMD Ryzen 7',
        memory: '16 GB RAM',
        graphics: 'GTX 1660 / RX 590',
        storage: '8 GB'
      },
      created_at: new Date('2025-12-05').toISOString(),
    }
  ],
  profiles: [],
  carts: {},
  orders: [],
  order_items: [],
  payments: [],
  wallet_transactions: [],
  downloads: [],
  notifications: [],
  audit_logs: [],
  coupons: [
    {
      id: 'coup-1111-1111-1111-111111111111',
      code: 'DINA50',
      description: 'DinaMaster 50% Off Special Promo',
      discount_type: 'PERCENTAGE',
      discount_value: 50,
      min_spend: 0,
      max_discount: null,
      usage_limit: 1000,
      times_used: 14,
      expires_at: null,
      is_active: true,
      created_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'coup-2222-2222-2222-222222222222',
      code: 'WELCOME20',
      description: 'New Customer Welcome - 20% Discount',
      discount_type: 'PERCENTAGE',
      discount_value: 20,
      min_spend: 10,
      max_discount: null,
      usage_limit: 500,
      times_used: 36,
      expires_at: null,
      is_active: true,
      created_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'coup-3333-3333-3333-333333333333',
      code: 'SAVE10',
      description: '$10 Instant Discount on Orders Over $20',
      discount_type: 'FIXED',
      discount_value: 10,
      min_spend: 20,
      max_discount: null,
      usage_limit: 200,
      times_used: 28,
      expires_at: null,
      is_active: true,
      created_at: new Date('2026-01-01').toISOString(),
    },
  ],
};

export const db = {
  isConfigured: () => isConfigured,
  store: devStore,

  // User Profile methods
  userPasswordCache: new Map(),

  async findUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    let found = null;
    if (isConfigured && supabase) {
      const { data } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
      if (data) found = data;
    }
    if (!found) {
      found = devStore.profiles.find(u => u.email.toLowerCase() === cleanEmail) || null;
    }
    if (found && this.userPasswordCache.has(cleanEmail)) {
      found.password_hash = this.userPasswordCache.get(cleanEmail);
    } else if (found && cleanEmail === 'dinacomputer0110@gmail.com' && !found.password_hash) {
      // Initialize fallback password hash for Admin@12345
      import('bcryptjs').then(({ default: bcrypt }) => {
        bcrypt.hash('Admin@12345', 10).then((h) => {
          this.userPasswordCache.set(cleanEmail, h);
        });
      }).catch(() => {});
    }
    return found;
  },

  async findUserById(id) {
    if (!id) return null;
    let found = null;
    if (isConfigured && supabase) {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (data) found = data;
    }
    if (!found) {
      found = devStore.profiles.find(u => u.id === id) || null;
    }
    return found;
  },

  async findUserByUsername(username) {
    if (!username) return null;
    const cleanUsername = username.trim();
    let found = null;
    if (isConfigured && supabase) {
      try {
        const { data } = await supabase.from('profiles').select('*').ilike('username', cleanUsername).maybeSingle();
        if (data) found = data;
      } catch (e) {}
    }
    if (!found) {
      found = devStore.profiles.find(u => u.username?.toLowerCase() === cleanUsername.toLowerCase()) || null;
    }
    return found;
  },

  async updateUser(id, updates) {
    if (!id) return null;
    let updated = null;
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .maybeSingle();
        if (data && !error) updated = data;
      } catch (e) {
        // ignore
      }
    }
    const idx = devStore.profiles.findIndex(u => u.id === id);
    if (idx >= 0) {
      devStore.profiles[idx] = {
        ...devStore.profiles[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      if (!updated) updated = devStore.profiles[idx];
    }
    return updated;
  },

  async createUser(userData) {
    if (userData.password_hash) {
      this.userPasswordCache.set(userData.email.toLowerCase(), userData.password_hash);
    }

    if (isConfigured && supabase) {
      let uid = (userData.id && !userData.id.startsWith('u0000000-')) ? userData.id : null;
      if (!uid) {
        try {
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: userData.email.toLowerCase(),
            password: userData.password || ('User@' + Math.random().toString(36).slice(-8) + 'Aa1!'),
            email_confirm: true,
            user_metadata: {
              username: userData.username,
              avatar_url: userData.avatar_url,
            }
          });
          if (authUser?.user?.id) {
            uid = authUser.user.id;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!uid) {
        try {
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const match = listData?.users?.find(u => u.email?.toLowerCase() === userData.email.toLowerCase());
          if (match) {
            uid = match.id;
          }
        } catch (e) {
          // ignore
        }
      }

      // If user exists in profiles table already, retrieve their ID
      if (!uid) {
        try {
          const { data: existingProf } = await supabase.from('profiles').select('id').eq('email', userData.email.toLowerCase()).maybeSingle();
          if (existingProf?.id) {
            uid = existingProf.id;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!uid) {
        // Fallback: in-memory development profile
        const newUser = {
          id: userData.id || crypto.randomUUID(),
          email: userData.email.toLowerCase(),
          username: userData.username,
          password_hash: userData.password_hash,
          avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
          role: userData.role || 'USER',
          balance: Number(userData.balance || 0.00),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const existingIdx = devStore.profiles.findIndex(p => p.email.toLowerCase() === newUser.email);
        if (existingIdx >= 0) {
          devStore.profiles[existingIdx] = { ...devStore.profiles[existingIdx], ...newUser };
        } else {
          devStore.profiles.push(newUser);
        }
        return newUser;
      }

      const profilePayload = {
        id: uid,
        email: userData.email.toLowerCase(),
        username: userData.username,
        avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
        role: userData.role || 'USER',
        balance: Number(userData.balance || 0.00),
        is_active: true,
      };

      let { data, error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }).select().single();
      if (error && (error.code === '23505' || error.message?.includes('profiles_username_key'))) {
        profilePayload.username = `${profilePayload.username.slice(0, 15)}_${Date.now().toString().slice(-4)}`;
        const retry = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error && !data) {
        console.warn('Profile upsert warning:', error.message);
        const { data: fallbackProfile } = await supabase.from('profiles').select('*').eq('email', userData.email.toLowerCase()).maybeSingle();
        if (fallbackProfile) return fallbackProfile;

        // Fallback to devStore
        const devUser = {
          id: userData.id || crypto.randomUUID(),
          email: userData.email.toLowerCase(),
          username: userData.username,
          password_hash: userData.password_hash,
          avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
          role: userData.role || 'USER',
          balance: Number(userData.balance || 0.00),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const existingIdx = devStore.profiles.findIndex(p => p.email.toLowerCase() === devUser.email);
        if (existingIdx >= 0) {
          devStore.profiles[existingIdx] = { ...devStore.profiles[existingIdx], ...devUser };
        } else {
          devStore.profiles.push(devUser);
        }
        return devUser;
      }
      return data;
    }

    const newUser = {
      id: userData.id || crypto.randomUUID(),
      email: userData.email.toLowerCase(),
      username: userData.username,
      password_hash: userData.password_hash,
      avatar_url: userData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.username}`,
      role: userData.role || 'USER',
      balance: userData.balance || 0.00,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    devStore.profiles.push(newUser);
    devStore.carts[newUser.id] = [];
    return newUser;
  },

  async seedDemoAccounts() {
    if (!isConfigured || !supabase) return;
    try {
      // 1. Auto-seed categories
      const categoriesToSeed = devStore.categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        image_url: c.image_url,
      }));
      await supabase.from('categories').upsert(categoriesToSeed, { onConflict: 'id' });

      // 2. Auto-seed game products
      const productsToSeed = devStore.products.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        short_description: p.short_description,
        price: p.price,
        discount_price: p.discount_price,
        category_id: p.category_id,
        platform: p.platform,
        version: p.version,
        developer: p.developer,
        publisher: p.publisher,
        release_date: p.release_date,
        cover_image: p.cover_image,
        screenshots: p.screenshots || [],
        file_path: p.file_path,
        file_name: p.file_name,
        file_size: p.file_size,
        system_requirements: p.system_requirements,
        is_published: true,
      }));
      await supabase.from('products').upsert(productsToSeed, { onConflict: 'id' });

      // 3. Elevate configured admin accounts if present
      if (ENV.ADMIN_EMAILS && ENV.ADMIN_EMAILS.length > 0) {
        for (const adminEmail of ENV.ADMIN_EMAILS) {
          const found = await db.findUserByEmail(adminEmail);
          if (found && found.role !== 'ADMIN') {
            await db.updateUser(found.id, { role: 'ADMIN' });
          }
        }
      }
    } catch (e) {
      console.warn('Supabase auto-seed notice:', e.message);
    }
  },



  // In-Memory store for password reset & OTP verification codes
  resetCache: new Map(),
  resetTokenCache: new Map(),

  hashOtp(code) {
    if (!code) return '';
    return crypto.createHash('sha256').update(code.toString().trim()).digest('hex');
  },

  storeOtp({ email, code, token, type = 'PASSWORD_RESET', expiresAt }) {
    const cleanEmail = email.toLowerCase().trim();
    const otpHash = code ? this.hashOtp(code) : '';
    this.resetCache.set(cleanEmail, {
      otpHash,
      token: token ? token.trim() : '',
      type,
      attempts: 0,
      verified: false,
      createdAt: Date.now(),
      expiresAt: expiresAt || Date.now() + 5 * 60 * 1000, // 5 minutes standard
    });
  },

  storePasswordReset({ email, code, token, expiresAt }) {
    this.storeOtp({ email, code, token, type: 'PASSWORD_RESET', expiresAt });
  },

  verifyOtpDetails({ email, code, token }) {
    const cleanEmail = email.toLowerCase().trim();
    const entry = this.resetCache.get(cleanEmail);
    if (!entry) {
      return { valid: false, error: 'No verification code was requested for this email. Please request a new one.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.resetCache.delete(cleanEmail);
      return { valid: false, error: 'OTP has expired. Please request a new code.' };
    }

    if (entry.attempts >= 5) {
      this.resetCache.delete(cleanEmail);
      return { valid: false, error: 'Too many OTP attempts. Please request a new verification code.' };
    }

    if (code) {
      const inputHash = this.hashOtp(code);
      if (entry.otpHash && inputHash === entry.otpHash) {
        entry.verified = true;
        return { valid: true };
      }
      entry.attempts += 1;
      return { valid: false, error: 'Invalid OTP. Please check the 6-digit code and try again.' };
    }

    if (token && entry.token && entry.token === token.trim()) {
      entry.verified = true;
      return { valid: true };
    }

    entry.attempts += 1;
    return { valid: false, error: 'Invalid verification token.' };
  },

  verifyOtp({ email, code, token }) {
    return this.verifyOtpDetails({ email, code, token }).valid;
  },

  verifyPasswordReset({ email, code, token }) {
    return this.verifyOtp({ email, code, token });
  },

  storeResetToken({ email, token, expiresAt }) {
    const cleanEmail = email.toLowerCase().trim();
    this.resetTokenCache.set(token.trim(), {
      email: cleanEmail,
      expiresAt: expiresAt || Date.now() + 15 * 60 * 1000,
      used: false,
    });
  },

  verifyResetToken(token) {
    if (!token) return null;
    const entry = this.resetTokenCache.get(token.trim());
    if (!entry) return null;
    if (entry.used || Date.now() > entry.expiresAt) {
      this.resetTokenCache.delete(token.trim());
      return null;
    }
    return entry;
  },

  consumeResetToken(token) {
    if (!token) return;
    const entry = this.resetTokenCache.get(token.trim());
    if (entry) {
      entry.used = true;
      this.resetTokenCache.delete(token.trim());
    }
  },

  consumeOtp(email) {
    this.resetCache.delete(email.toLowerCase().trim());
  },

  consumePasswordReset(email) {
    this.consumeOtp(email);
  },

  async updateUserPassword({ email, newPassword, newPasswordHash }) {
    const cleanEmail = email.toLowerCase().trim();
    this.userPasswordCache.set(cleanEmail, newPasswordHash);
    const user = await this.findUserByEmail(cleanEmail);
    if (!user) throw new Error('User not found');

    if (isConfigured && supabase) {
      try {
        await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
      } catch (authErr) {
        console.warn('Supabase auth password update notice:', authErr.message);
      }
      try {
        await supabase.from('profiles').update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() }).eq('id', user.id);
      } catch (pErr) {
        // ignore if column doesn't exist
      }
      return { ...user, password_hash: newPasswordHash };
    }

    const idx = devStore.profiles.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (idx !== -1) {
      devStore.profiles[idx].password_hash = newPasswordHash;
      devStore.profiles[idx].updated_at = new Date().toISOString();
      return devStore.profiles[idx];
    }
    return { ...user, password_hash: newPasswordHash };
  },

  // Products
  async getProducts({ category, search, platform, minPrice, maxPrice, isPublished = true, sort = 'newest' } = {}) {
    if (isConfigured && supabase) {
      let query = supabase.from('products').select('*, category:categories(id, name, slug)');
      if (isPublished !== undefined) query = query.eq('is_published', isPublished);
      if (category) query = query.eq('categories.slug', category);
      if (platform) query = query.ilike('platform', `%${platform}%`);
      if (search) query = query.or(`title.ilike.%${search}%,developer.ilike.%${search}%,publisher.ilike.%${search}%`);
      if (minPrice !== undefined) query = query.gte('price', minPrice);
      if (maxPrice !== undefined) query = query.lte('price', maxPrice);

      if (sort === 'price_asc') query = query.order('price', { ascending: true });
      else if (sort === 'price_desc') query = query.order('price', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      try {
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase getProducts notice:', e.message);
      }
    }

    // In-memory filter
    let list = [...devStore.products];
    if (isPublished !== undefined) list = list.filter(p => p.is_published === isPublished);
    if (category) {
      const cat = devStore.categories.find(c => c.slug === category);
      if (cat) list = list.filter(p => p.category_id === cat.id);
    }
    if (platform) {
      list = list.filter(p => p.platform.toLowerCase().includes(platform.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.developer && p.developer.toLowerCase().includes(q)) ||
        (p.publisher && p.publisher.toLowerCase().includes(q))
      );
    }

    return list.map(p => ({
      ...p,
      category: devStore.categories.find(c => c.id === p.category_id) || null
    }));
  },

  async getProductBySlug(slug) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*, category:categories(id, name, slug)').eq('slug', slug).maybeSingle();
        if (!error && data) return data;
      } catch (e) {}
    }
    const p = devStore.products.find(prod => prod.slug === slug);
    if (!p) return null;
    return {
      ...p,
      category: devStore.categories.find(c => c.id === p.category_id) || null
    };
  },

  async getProductById(id) {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*, category:categories(id, name, slug)').eq('id', id).maybeSingle();
        if (!error && data) return data;
      } catch (e) {}
    }
    const p = devStore.products.find(prod => prod.id === id);
    if (!p) return null;
    return {
      ...p,
      category: devStore.categories.find(c => c.id === p.category_id) || null
    };
  },

  // Categories
  async getCategories() {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('categories').select('*').order('name');
        if (!error && data && data.length > 0) return data;
      } catch (e) {}
    }
    return devStore.categories;
  },



  // Orders
  async createOrder({ userId, totalAmount, paymentMethod, transactionId, items, couponCode = null, discountAmount = 0 }) {
    const orderId = crypto.randomUUID();
    // Normalize payment method for Supabase check constraint ('ABA_PAYWAY', 'WALLET_BALANCE')
    const dbPaymentMethod = ['ABA_PAYWAY', 'WALLET_BALANCE'].includes(paymentMethod)
      ? paymentMethod
      : 'ABA_PAYWAY';

    const newOrder = {
      id: orderId,
      user_id: userId,
      total_amount: Number(totalAmount),
      coupon_code: couponCode,
      discount_amount: Number(discountAmount) || 0,
      currency: 'USD',
      status: 'PENDING',
      payment_status: 'PENDING',
      payment_method: dbPaymentMethod,
      transaction_id: transactionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      let { data: order, error: orderErr } = await supabase.from('orders').insert({ ...newOrder, payment_method: paymentMethod }).select().single();

      // If check constraint fails for non-standard payment_method (e.g. 'CUTLUY'), retry with normalized method
      if (orderErr && (orderErr.message?.includes('orders_payment_method_check') || orderErr.code === '23514')) {
        const fallback = await supabase.from('orders').insert(newOrder).select().single();
        order = fallback.data;
        orderErr = fallback.error;
      }

      // If schema cache error for coupon columns (migration not yet run), retry without coupon fields
      if (orderErr && (orderErr.code === 'PGRST204' || orderErr.message?.includes('coupon_code') || orderErr.message?.includes('discount_amount'))) {
        const { coupon_code: _cc, discount_amount: _da, ...orderWithoutCoupon } = newOrder;
        const retry1 = await supabase.from('orders').insert({ ...orderWithoutCoupon, payment_method: paymentMethod }).select().single();
        if (retry1.error && (retry1.error.message?.includes('orders_payment_method_check') || retry1.error.code === '23514')) {
          const retry2 = await supabase.from('orders').insert(orderWithoutCoupon).select().single();
          order = retry2.data;
          orderErr = retry2.error;
        } else {
          order = retry1.data;
          orderErr = retry1.error;
        }
      }

      if (!orderErr && order) {
        const orderItems = items.map(item => ({
          id: crypto.randomUUID(),
          order_id: order.id,
          product_id: item.id,
          product_title: item.title,
          price: item.discount_price !== null && item.discount_price !== undefined ? Number(item.discount_price) : Number(item.price),
          quantity: 1,
          created_at: new Date().toISOString(),
        }));

        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
        if (itemsErr) console.warn('Supabase order_items insert notice:', itemsErr.message);

        devStore.orders.push({ ...newOrder, ...order });
        devStore.order_items.push(...orderItems);

        return { ...order, payment_method: paymentMethod, items: orderItems };
      } else {
        console.warn('Supabase createOrder fallback notice:', orderErr?.message);
      }
    }

    const orderItems = items.map(item => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.id,
      product_title: item.title,
      price: item.discount_price !== null && item.discount_price !== undefined ? Number(item.discount_price) : Number(item.price),
      quantity: 1,
      created_at: new Date().toISOString(),
    }));

    devStore.orders.push(newOrder);
    devStore.order_items.push(...orderItems);
    return { ...newOrder, items: orderItems };
  },

  async getOrderById(orderId) {
    if (isConfigured && supabase) {
      const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', orderId).maybeSingle();
      return data;
    }
    const order = devStore.orders.find(o => o.id === orderId);
    if (!order) return null;
    const items = devStore.order_items.filter(i => i.order_id === orderId);
    return { ...order, items };
  },

  async getOrderByTransactionId(transactionId) {
    if (isConfigured && supabase) {
      const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('transaction_id', transactionId).maybeSingle();
      return data;
    }
    const order = devStore.orders.find(o => o.transaction_id === transactionId);
    if (!order) return null;
    const items = devStore.order_items.filter(i => i.order_id === order.id);
    return { ...order, items };
  },

  async getUserOrders(userId) {
    if (isConfigured && supabase) {
      const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('user_id', userId).order('created_at', { ascending: false });
      return data || [];
    }
    return devStore.orders
      .filter(o => o.user_id === userId)
      .map(o => ({
        ...o,
        items: devStore.order_items.filter(i => i.order_id === o.id),
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Check if a user has purchased a product
  async hasUserPurchasedProduct(userId, productId) {
    if (isConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('order_items')
          .select('id, orders!inner(user_id, status)')
          .eq('product_id', productId)
          .eq('orders.user_id', userId)
          .in('orders.status', ['PAID', 'COMPLETED'])
          .limit(1);
        if (data && data.length > 0) return true;
      } catch (e) {}
    }

    const paidOrderIds = devStore.orders
      .filter(o => o.user_id === userId && (o.status === 'PAID' || o.status === 'COMPLETED'))
      .map(o => o.id);

    return devStore.order_items.some(
      item => item.product_id === productId && paidOrderIds.includes(item.order_id)
    );
  },

  // Wallet operations
  async adjustWallet({ userId, type, amount, referenceId, description }) {
    const numAmount = Number(amount);
    const user = await this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const currentBalance = Number(user.balance);
    const newBalance = Number((currentBalance + numAmount).toFixed(2));

    if (newBalance < 0) {
      throw new Error(`Insufficient wallet balance. Current: $${currentBalance}, Deduction: $${Math.abs(numAmount)}`);
    }

    await this.updateUser(userId, { balance: newBalance });

    const tx = {
      id: crypto.randomUUID(),
      user_id: userId,
      type,
      amount: numAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      reference_id: referenceId || null,
      description: description || `Wallet ${type}`,
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      await supabase.from('wallet_transactions').insert(tx);
    } else {
      devStore.wallet_transactions.push(tx);
    }

    return { success: true, balance_before: currentBalance, balance_after: newBalance, transaction: tx };
  },

  // Audit Logs
  async createAuditLog({ adminId, action, targetType, targetId, metadata }) {
    const log = {
      id: crypto.randomUUID(),
      admin_id: adminId || null,
      action,
      target_type: targetType,
      target_id: targetId || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      await supabase.from('audit_logs').insert(log);
    } else {
      devStore.audit_logs.push(log);
    }
    return log;
  },

  // Notifications
  async createNotification({ userId, title, message, type = 'INFO' }) {
    const notif = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      await supabase.from('notifications').insert(notif);
    } else {
      devStore.notifications.push(notif);
    }
    return notif;
  },

  // ==========================================
  // Coupon & Discount Code Methods
  // ==========================================

  // Normalize Supabase coupon fields to the internal API shape
  _normalizeCoupon(c) {
    if (!c) return c;
    return {
      ...c,
      // Supabase uses current_uses + max_uses; devStore uses times_used + usage_limit
      times_used: c.times_used ?? c.current_uses ?? 0,
      usage_limit: c.usage_limit ?? c.max_uses ?? null,
      min_spend: c.min_spend ?? c.min_order_amount ?? 0,
    };
  },

  async listCoupons() {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
        if (!error && data) return (data || []).map((c) => this._normalizeCoupon(c));
      } catch (e) {}
    }
    return devStore.coupons.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async findCouponByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();

    // Map common aliases so user inputs always resolve
    const codeCandidates = [cleanCode];
    if (['1%', '0.01', '0.01%', '1PCT', 'SAVE1', 'SAVE1PCT', '1'].includes(cleanCode)) {
      codeCandidates.push('1%', '0.01', 'SAVE1PCT');
    } else if (['2%', '0.02', '0.02%', '2PCT', 'SAVE2', 'SAVE2PCT', '2'].includes(cleanCode)) {
      codeCandidates.push('2%', '0.02', 'SAVE2PCT');
    } else if (['3%', '0.03', '0.03%', '3PCT', 'SAVE3', 'SAVE3PCT', '3'].includes(cleanCode)) {
      codeCandidates.push('3%', '0.03', 'SAVE3PCT');
    } else if (['4%', '0.04', '0.04%', '4PCT', 'SAVE4', 'SAVE4PCT', '4'].includes(cleanCode)) {
      codeCandidates.push('4%', '0.04', 'SAVE4PCT');
    } else if (['0.05', '0.05%', '5%', '5PCT', 'SAVE5', 'SAVE5PCT', '5%'].includes(cleanCode)) {
      codeCandidates.push('0.05', 'SAVE5PCT', '5%');
    } else if (['0.10', '0.1', '0.10%', '0.1%', '10%', '10PCT', 'SAVE10PCT', 'WELCOME10', 'WELCOME20'].includes(cleanCode)) {
      codeCandidates.push('0.10', 'SAVE10PCT', '10%');
    } else if (['0.15', '0.15%', '15%', '15PCT', 'SAVE15PCT'].includes(cleanCode)) {
      codeCandidates.push('0.15', 'SAVE15PCT', '15%');
    } else if (['5$', '$5', '5USD', 'FLAT5USD', 'SAVE5USD', '5', '0.05 TO 5$'].includes(cleanCode)) {
      codeCandidates.push('5$', 'FLAT5USD', '$5');
    }

    if (isConfigured && supabase) {
      for (const cand of codeCandidates) {
        try {
          // Use exact uppercase match first to avoid SQL % wildcard matching
          const { data, error } = await supabase.from('coupons').select('*').eq('code', cand.toUpperCase()).maybeSingle();
          if (!error && data) return this._normalizeCoupon(data);

          // Fallback to escaped ilike
          const escaped = cand.replace(/[%_\\]/g, '\\$&');
          const { data: ilikeData } = await supabase.from('coupons').select('*').ilike('code', escaped).maybeSingle();
          if (ilikeData) return this._normalizeCoupon(ilikeData);
        } catch (e) {}
      }
    }

    for (const cand of codeCandidates) {
      const found = devStore.coupons.find((c) => c.code.toUpperCase() === cand);
      if (found) return this._normalizeCoupon(found);
    }

    // Ultimate fallback for standard discount codes (1%, 2%, 3%, 4%, 5%, 10%, 15%, 5$) so checkout never fails
    if (['1%', '0.01', '0.01%', '1PCT', 'SAVE1', 'SAVE1PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-001-1pct-discount',
        code: '1%',
        description: '1% Instant Discount',
        discount_type: 'PERCENTAGE',
        discount_value: 1,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['2%', '0.02', '0.02%', '2PCT', 'SAVE2', 'SAVE2PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-002-2pct-discount',
        code: '2%',
        description: '2% Instant Discount',
        discount_type: 'PERCENTAGE',
        discount_value: 2,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['3%', '0.03', '0.03%', '3PCT', 'SAVE3', 'SAVE3PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-003-3pct-discount',
        code: '3%',
        description: '3% Instant Discount',
        discount_type: 'PERCENTAGE',
        discount_value: 3,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['4%', '0.04', '0.04%', '4PCT', 'SAVE4', 'SAVE4PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-004-4pct-discount',
        code: '4%',
        description: '4% Instant Discount',
        discount_type: 'PERCENTAGE',
        discount_value: 4,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['0.05', '0.05%', '5%', '5PCT', 'SAVE5', 'SAVE5PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-005-5pct-discount',
        code: '0.05',
        description: '5% Instant Discount (0.05)',
        discount_type: 'PERCENTAGE',
        discount_value: 5,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['0.10', '0.1', '0.10%', '0.1%', '10%', '10PCT', 'SAVE10PCT', 'WELCOME10', 'SAVE10'].includes(cleanCode)) {
      return {
        id: 'virtual-010-10pct-discount',
        code: '0.10',
        description: '10% Instant Discount (0.10)',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['0.15', '0.15%', '15%', '15PCT', 'SAVE15PCT'].includes(cleanCode)) {
      return {
        id: 'virtual-015-15pct-discount',
        code: '0.15',
        description: '15% Instant Discount (0.15)',
        discount_type: 'PERCENTAGE',
        discount_value: 15,
        min_spend: 0,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }
    if (['5$', '$5', '5USD', 'FLAT5USD', '5', '0.05 TO 5$'].includes(cleanCode)) {
      return {
        id: 'virtual-005-5usd-discount',
        code: '5$',
        description: '$5 Instant Fixed Discount',
        discount_type: 'FIXED',
        discount_value: 5,
        min_spend: 5,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      };
    }

    return null;
  },

  async findExactCouponByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('coupons').select('*').eq('code', cleanCode).maybeSingle();
        if (!error && data) return this._normalizeCoupon(data);
      } catch (e) {}
    }
    const found = devStore.coupons.find((c) => c.code.toUpperCase() === cleanCode);
    return found ? this._normalizeCoupon(found) : null;
  },

  async createCoupon(data) {
    const cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Coupon code is required');

    const existing = await this.findExactCouponByCode(cleanCode);
    if (existing) throw new Error(`Coupon code '${cleanCode}' already exists`);

    const newCoupon = {
      id: data.id || crypto.randomUUID(),
      code: cleanCode,
      description: data.description || '',
      discount_type: data.discount_type === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
      discount_value: Number(data.discount_value) || 0,
      min_spend: Number(data.min_spend) || 0,
      max_discount: data.max_discount ? Number(data.max_discount) : null,
      usage_limit: data.usage_limit ? Number(data.usage_limit) : null,
      times_used: 0,
      expires_at: data.expires_at || null,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      try {
        // Map to Supabase column names (current_uses, max_uses, min_order_amount)
        const sbCoupon = {
          id: newCoupon.id,
          code: newCoupon.code,
          description: newCoupon.description,
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          min_order_amount: newCoupon.min_spend || 0,
          max_uses: newCoupon.usage_limit || null,
          current_uses: 0,
          expires_at: newCoupon.expires_at || null,
          is_active: newCoupon.is_active,
        };
        const { data: inserted, error } = await supabase.from('coupons').insert(sbCoupon).select().single();
        if (!error && inserted) {
          const normalized = this._normalizeCoupon(inserted);
          devStore.coupons.unshift(normalized);
          return normalized;
        }
        if (error) console.warn('Supabase coupon insert notice:', error.message);
      } catch (e) { console.warn('Supabase coupon insert error:', e.message); }
    }

    devStore.coupons.unshift(newCoupon);
    return newCoupon;
  },

  async updateCoupon(id, updates) {
    if (!id) throw new Error('Coupon ID is required');

    const sbUpdates = { updated_at: new Date().toISOString() };
    if ('code' in updates) sbUpdates.code = (updates.code || '').trim().toUpperCase();
    if ('description' in updates) sbUpdates.description = updates.description;
    if ('discount_type' in updates) sbUpdates.discount_type = updates.discount_type;
    if ('discount_value' in updates) sbUpdates.discount_value = Number(updates.discount_value);
    if ('min_spend' in updates) sbUpdates.min_order_amount = Number(updates.min_spend) || 0;
    if ('min_order_amount' in updates) sbUpdates.min_order_amount = Number(updates.min_order_amount) || 0;
    if ('usage_limit' in updates) sbUpdates.max_uses = updates.usage_limit ? Number(updates.usage_limit) : null;
    if ('max_uses' in updates) sbUpdates.max_uses = updates.max_uses ? Number(updates.max_uses) : null;
    if ('times_used' in updates) sbUpdates.current_uses = Number(updates.times_used) || 0;
    if ('current_uses' in updates) sbUpdates.current_uses = Number(updates.current_uses) || 0;
    if ('is_active' in updates) sbUpdates.is_active = Boolean(updates.is_active);
    if ('expires_at' in updates) sbUpdates.expires_at = updates.expires_at || null;

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('coupons').update(sbUpdates).eq('id', id).select().single();
        if (!error && data) {
          const normalized = this._normalizeCoupon(data);
          const idx = devStore.coupons.findIndex((c) => c.id === id);
          if (idx !== -1) {
            devStore.coupons[idx] = { ...devStore.coupons[idx], ...normalized };
          } else {
            devStore.coupons.push(normalized);
          }
          return normalized;
        }
        if (error) {
          console.warn('Supabase coupon update error:', error.message);
        }
      } catch (e) {
        console.warn('Supabase coupon update exception:', e.message);
      }
    }

    const idx = devStore.coupons.findIndex((c) => c.id === id);
    if (idx === -1) {
      // If found in Supabase previously or id was created, create or return
      const fallbackCoupon = {
        id,
        ...sbUpdates,
        times_used: sbUpdates.current_uses || 0,
        usage_limit: sbUpdates.max_uses || null,
        min_spend: sbUpdates.min_order_amount || 0,
      };
      devStore.coupons.push(fallbackCoupon);
      return this._normalizeCoupon(fallbackCoupon);
    }
    devStore.coupons[idx] = { ...devStore.coupons[idx], ...updates, updated_at: new Date().toISOString() };
    return this._normalizeCoupon(devStore.coupons[idx]);
  },

  async deleteCoupon(id) {
    if (!id) throw new Error('Coupon ID is required');
    if (isConfigured && supabase) {
      try {
        await supabase.from('coupons').delete().eq('id', id);
      } catch (e) {}
    }
    const idx = devStore.coupons.findIndex((c) => c.id === id);
    if (idx !== -1) devStore.coupons.splice(idx, 1);
    return true;
  },

  async validateCoupon(code, cartTotal) {
    if (!code) {
      return { valid: false, message: 'Please enter a coupon code' };
    }
    const cleanCode = code.trim().toUpperCase();
    const coupon = await this.findCouponByCode(cleanCode);

    if (!coupon) {
      return { valid: false, message: `Coupon code '${cleanCode}' does not exist` };
    }
    if (!coupon.is_active) {
      return { valid: false, message: `Coupon code '${cleanCode}' is currently inactive` };
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, message: `Coupon code '${cleanCode}' has expired` };
    }
    if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
      return { valid: false, message: `Coupon code '${cleanCode}' has reached its maximum usage limit` };
    }

    const numTotal = Number(cartTotal) || 0;
    if (coupon.min_spend && numTotal < Number(coupon.min_spend)) {
      return {
        valid: false,
        message: `Minimum order amount of $${Number(coupon.min_spend).toFixed(2)} required for code '${cleanCode}'`,
      };
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'PERCENTAGE') {
      // Auto-convert decimal fraction (0.01 → 1%, 0.05 → 5%, 0.10 → 10%, 0.15 → 15%)
      let pctValue = Number(coupon.discount_value);
      if (pctValue > 0 && pctValue < 1) pctValue = pctValue * 100;
      discountAmount = (numTotal * pctValue) / 100;
      if (coupon.max_discount && discountAmount > Number(coupon.max_discount)) {
        discountAmount = Number(coupon.max_discount);
      }
    } else {
      discountAmount = Number(coupon.discount_value);
    }

    discountAmount = Math.min(discountAmount, numTotal);
    const finalTotal = Math.max(0, numTotal - discountAmount);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        // Normalize: if PERCENTAGE stored as decimal (< 1 e.g. 0.05), return as percentage for display
        discountValue: coupon.discount_type === 'PERCENTAGE' && Number(coupon.discount_value) < 1
          ? Number((Number(coupon.discount_value) * 100).toFixed(2))
          : Number(coupon.discount_value),
        discountAmount: Number(discountAmount.toFixed(2)),
        finalTotal: Number(finalTotal.toFixed(2)),
        minSpend: Number(coupon.min_spend || 0),
      },
    };
  },

  async incrementCouponUsage(code) {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const coupon = await this.findCouponByCode(cleanCode);
    if (!coupon || String(coupon.id).startsWith('virtual-')) return;

    const newTimesUsed = (coupon.times_used || 0) + 1;
    // Update both field name variants for compatibility
    await this.updateCoupon(coupon.id, { times_used: newTimesUsed, current_uses: newTimesUsed });
  },

  // ==========================================
  // Spin Wheel Methods
  // ==========================================

  async listSpinSegments() {
    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('spin_segments').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) return data;
      } catch (e) {}
    }
    return devStore.spinSegments.slice();
  },

  async createSpinSegment(segData) {
    // Sanitize: convert empty strings to proper types to avoid Supabase numeric errors
    const rawPrizeValue = segData.prize_value;
    const prizeValueNum = (rawPrizeValue === '' || rawPrizeValue === null || rawPrizeValue === undefined)
      ? 0
      : Number(rawPrizeValue) || 0;
    const weightNum = Number(segData.weight) || 10;

    const seg = {
      id: crypto.randomUUID(),
      label: segData.label || 'Prize',
      color: segData.color || '#06b6d4',
      prize_type: segData.prize_type || 'NONE',
      // Store prize_value as text for BADGE (e.g. 'VIP Gamer'), numeric string for others
      prize_value: segData.prize_type === 'BADGE'
        ? String(rawPrizeValue || 'Prize')
        : String(prizeValueNum),
      weight: weightNum,
      is_active: segData.is_active !== undefined ? Boolean(segData.is_active) : true,
      created_at: new Date().toISOString(),
    };

    if (isConfigured && supabase) {
      try {
        // Build Supabase-safe payload: use numeric types for numeric columns
        const sbSeg = {
          ...seg,
          prize_value: prizeValueNum,  // Supabase numeric column — no empty strings
          weight: weightNum,
        };
        const { data, error } = await supabase.from('spin_segments').insert(sbSeg).select().single();
        if (!error && data) return { ...data, prize_value: String(data.prize_value ?? prizeValueNum) };
        if (error) console.warn('Supabase spin_segments insert error:', error.message);
      } catch (e) { console.warn('createSpinSegment error:', e.message); }
    }
    devStore.spinSegments.push(seg);
    return seg;
  },

  async updateSpinSegment(id, updates) {
    const allowed = ['label', 'color', 'prize_type', 'prize_value', 'weight', 'is_active'];
    const clean = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) clean[key] = updates[key];
    }
    clean.updated_at = new Date().toISOString();

    if (isConfigured && supabase) {
      try {
        // Build Supabase-safe payload: sanitize numeric columns
        const sbClean = { ...clean };
        if (sbClean.prize_value !== undefined) {
          const pType = sbClean.prize_type || updates.prize_type || 'NONE';
          if (pType === 'BADGE') {
            // Keep as text for badge — but Supabase may still require numeric; convert gracefully
            sbClean.prize_value = 0; // Supabase numeric column: store 0, display value kept in label
          } else {
            const pv = sbClean.prize_value;
            sbClean.prize_value = (pv === '' || pv === null || pv === undefined) ? 0 : Number(pv) || 0;
          }
        }
        if (sbClean.weight !== undefined) {
          sbClean.weight = (sbClean.weight === '' || sbClean.weight === null) ? 10 : Number(sbClean.weight) || 10;
        }
        const { data, error } = await supabase.from('spin_segments').update(sbClean).eq('id', id).select().single();
        if (!error && data) {
          // Return with string prize_value for consistency
          return { ...data, prize_value: String(data.prize_value ?? '') };
        }
        if (error) console.warn('Supabase spin_segments update error:', error.message);
      } catch (e) { console.warn('updateSpinSegment error:', e.message); }
    }

    const idx = devStore.spinSegments.findIndex((s) => s.id === id);
    if (idx !== -1) {
      devStore.spinSegments[idx] = { ...devStore.spinSegments[idx], ...clean };
      return devStore.spinSegments[idx];
    }
    return null;
  },

  async deleteSpinSegment(id) {
    if (isConfigured && supabase) {
      try { await supabase.from('spin_segments').delete().eq('id', id); } catch (e) {}
    }
    const idx = devStore.spinSegments.findIndex((s) => s.id === id);
    if (idx !== -1) devStore.spinSegments.splice(idx, 1);
  },

  async hasSpinForOrder(orderId) {
    if (isConfigured && supabase) {
      try {
        const { data } = await supabase.from('spin_records').select('id').eq('order_id', orderId).limit(1);
        if (data && data.length > 0) return true;
      } catch (e) {}
    }
    return devStore.spinRecords.some((r) => r.order_id === orderId);
  },

  async recordSpin({ userId, orderId, segmentId, prizeType, prizeValue, prizeLabel }) {
    const record = {
      id: crypto.randomUUID(),
      user_id: userId,
      order_id: orderId,
      segment_id: segmentId,
      prize_type: prizeType,
      prize_value: prizeValue,
      prize_label: prizeLabel,
      created_at: new Date().toISOString(),
    };
    if (isConfigured && supabase) {
      try { await supabase.from('spin_records').insert(record); } catch (e) {}
    }
    devStore.spinRecords.push(record);
    return record;
  },

  // Pick a prize segment by weighted random selection
  pickSpinSegment(segments) {
    const active = segments.filter((s) => s.is_active);
    if (!active.length) return null;
    const total = active.reduce((sum, s) => sum + Number(s.weight || 1), 0);
    let rand = Math.random() * total;
    for (const seg of active) {
      rand -= Number(seg.weight || 1);
      if (rand <= 0) return seg;
    }
    return active[active.length - 1];
  },
};

export default db;
