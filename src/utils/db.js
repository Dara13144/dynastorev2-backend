import { supabase, isConfigured } from '../config/supabase.js';
import crypto from 'crypto';

// In-Memory Dev Store for fallback when Supabase is not connected
const devStore = {
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
  profiles: [
    {
      id: 'u0000000-0000-0000-0000-000000000009',
      email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com',
      username: 'DynaMasterAdmin',
      password_hash: '$2b$10$vj4dkm0jY4PLPC0tvY2t..RkuqxfBTrC/MUMlmVLKqFRRuoq7iTKy',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DynaMasterAdmin',
      role: 'ADMIN',
      balance: 500.00,
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'u0000000-0000-0000-0000-000000000002',
      email: 'gamer@dynastore.com',
      username: 'pro_gamer',
      password_hash: '$2b$10$3uLKbbETf9NIcnBrDO0Z.uIANg09wuHuUFq2qQbHfyEeFx9Rcs0mW',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=gamer_pro',
      role: 'USER',
      balance: 50.00,
      is_active: true,
      created_at: new Date().toISOString(),
    }
  ],
  carts: {},
  orders: [],
  order_items: [],
  payments: [],
  wallet_transactions: [
    {
      id: 'wt-001',
      user_id: 'u0000000-0000-0000-0000-000000000001',
      type: 'ADMIN_ADJUSTMENT',
      amount: 150.00,
      balance_before: 0.00,
      balance_after: 150.00,
      reference_id: 'INITIAL_GRANT',
      description: 'Initial Admin balance setup',
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
    },
    {
      id: 'wt-002',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      type: 'DEPOSIT',
      amount: 50.00,
      balance_before: 0.00,
      balance_after: 50.00,
      reference_id: 'ABA-INIT-9921',
      description: 'Deposit via ABA PayWay',
      status: 'COMPLETED',
      created_at: new Date().toISOString(),
    }
  ],
  downloads: [],
  notifications: [
    {
      id: 'notif-001',
      user_id: 'u0000000-0000-0000-0000-000000000002',
      title: 'Welcome to DynaStore!',
      message: 'Your account is ready. Explore top games and pay securely via ABA PayWay or your digital wallet.',
      type: 'INFO',
      is_read: false,
      created_at: new Date().toISOString(),
    }
  ],
  audit_logs: [
    {
      id: 'audit-001',
      admin_id: 'u0000000-0000-0000-0000-000000000001',
      action: 'SYSTEM_INIT',
      target_type: 'DATABASE',
      target_id: 'ALL',
      metadata: { note: 'DynaStore system initialized' },
      created_at: new Date().toISOString(),
    }
  ]
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

  async createUser(userData) {
    if (userData.password_hash) {
      userPasswordCache.set(userData.email.toLowerCase(), userData.password_hash);
    }

    if (isConfigured && supabase) {
      let uid = (userData.id && !userData.id.startsWith('u0000000-')) ? userData.id : null;
      if (!uid) {
        try {
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: userData.email.toLowerCase(),
            password: 'User@' + Math.random().toString(36).slice(-8) + 'Aa1!',
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

      // 3. Auto-seed demo & admin accounts
      const demoUsers = [
        { email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com', username: 'DynaMasterAdmin', role: 'ADMIN', balance: 500.00, password_hash: '$2b$10$vj4dkm0jY4PLPC0tvY2t..RkuqxfBTrC/MUMlmVLKqFRRuoq7iTKy' },
        { email: 'gamer@dynastore.com', username: 'CyberGamer', role: 'USER', balance: 50.00 },
      ];
      for (const u of demoUsers) {
        const found = await db.findUserByEmail(u.email);
        if (!found) {
          await db.createUser(u);
        } else if (u.role === 'ADMIN' && found.role !== 'ADMIN') {
          await db.updateUser(found.id, { role: 'ADMIN' });
        }
      }
    } catch (e) {
      console.warn('Supabase auto-seed notice:', e.message);
    }
  },

  async updateUser(id, updates) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const idx = devStore.profiles.findIndex(u => u.id === id);
    if (idx !== -1) {
      devStore.profiles[idx] = { ...devStore.profiles[idx], ...updates, updated_at: new Date().toISOString() };
      return devStore.profiles[idx];
    }
    return null;
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

      const { data, error } = await query;
      if (error) throw error;
      return data;
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
      const { data } = await supabase.from('products').select('*, category:categories(id, name, slug)').eq('slug', slug).maybeSingle();
      return data;
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
      const { data } = await supabase.from('products').select('*, category:categories(id, name, slug)').eq('id', id).maybeSingle();
      return data;
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
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    }
    return devStore.categories;
  },

  async hasUserPurchasedProduct(userId, productId) {
    try {
      if (isConfigured && supabase) {
        const { data } = await supabase
          .from('order_items')
          .select('id, order:orders!inner(user_id, status)')
          .eq('product_id', productId)
          .eq('orders.user_id', userId)
          .eq('orders.status', 'PAID')
          .limit(1);
        return Boolean(data && data.length > 0);
      }
      const userOrders = devStore.orders.filter(o => o.user_id === userId && o.status === 'PAID');
      const userOrderIds = userOrders.map(o => o.id);
      return devStore.order_items.some(item => userOrderIds.includes(item.order_id) && item.product_id === productId);
    } catch (e) {
      return false;
    }
  },

  // Orders
  async createOrder({ userId, totalAmount, paymentMethod, transactionId, items }) {
    const orderId = crypto.randomUUID();
    // Normalize payment method for Supabase check constraint ('ABA_PAYWAY', 'WALLET_BALANCE')
    const dbPaymentMethod = ['ABA_PAYWAY', 'WALLET_BALANCE'].includes(paymentMethod)
      ? paymentMethod
      : 'ABA_PAYWAY';

    const newOrder = {
      id: orderId,
      user_id: userId,
      total_amount: Number(totalAmount),
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
      
      // If Postgres check constraint fails for 'CUTLUY' or other methods, use dbPaymentMethod ('ABA_PAYWAY')
      if (orderErr && (orderErr.message?.includes('orders_payment_method_check') || orderErr.code === '23514')) {
        const fallback = await supabase.from('orders').insert(newOrder).select().single();
        order = fallback.data;
        orderErr = fallback.error;
      }

      if (orderErr) throw orderErr;

      const orderItems = items.map(item => ({
        id: crypto.randomUUID(),
        order_id: order.id,
        product_id: item.id,
        product_title: item.title,
        price: item.discount_price !== null && item.discount_price !== undefined ? Number(item.discount_price) : Number(item.price),
        quantity: 1,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      return { ...order, payment_method: paymentMethod, items: orderItems };
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
      const { data } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('product_id', productId)
        .eq('orders.user_id', userId)
        .in('orders.status', ['PAID', 'COMPLETED'])
        .limit(1);
      return Boolean(data && data.length > 0);
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

  // Seed / Elevate Master Admin
  async seedDemoAccounts() {
    try {
      const admins = [
        { email: 'dynastore23084720893yiusjfhgisriw4rihldfjgsijfhweu@gmail.com', username: 'DynaMasterAdmin', password_hash: '$2b$10$vj4dkm0jY4PLPC0tvY2t..RkuqxfBTrC/MUMlmVLKqFRRuoq7iTKy' },
      ];

      for (const adm of admins) {
        const existing = await this.findUserByEmail(adm.email);
        if (!existing) {
          await this.createUser({
            email: adm.email,
            username: adm.username,
            password_hash: adm.password_hash || '$2a$10$wT8fH.U7JmF2wG1rK9b2I.7T5jB.9T6uF8s8A7e4z5c2v1b0n9m8.',
            role: 'ADMIN',
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${adm.email}`,
            balance: 500.00,
          });
        } else {
          const updates = {};
          if (existing.role !== 'ADMIN') updates.role = 'ADMIN';
          if (adm.password_hash) updates.password_hash = adm.password_hash;
          if (Object.keys(updates).length > 0) {
            await this.updateUser(existing.id, updates);
          }
        }
      }
    } catch (err) {
      console.warn('Seed accounts notice:', err.message);
    }
  }
};

export default db;
