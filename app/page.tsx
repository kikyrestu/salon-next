'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Scissors, 
  Sparkles, 
  Clock, 
  MapPin, 
  Instagram, 
  Phone, 
  ChevronRight, 
  Menu, 
  X, 
  Users, 
  Camera,
  Star,
  Award
} from 'lucide-react';

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [slug, setSlug] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.trim()) {
        router.push(`/${slug.trim()}/login`);
    }
  };

  const services = [
    {
      title: "Signature Hair Sculpting",
      description: "Transformasi mahkota Anda dengan teknik pemotongan presisi yang menyesuaikan dengan struktur wajah dan karakter personal.",
      icon: <Scissors className="w-6 h-6" />,
      tag: "Artisan"
    },
    {
      title: "Chromatic Color Lab",
      description: "Eksplorasi warna tanpa batas menggunakan formula premium yang menjaga kesehatan kutikula rambut secara maksimal.",
      icon: <Sparkles className="w-6 h-6" />,
      tag: "Advanced"
    },
    {
      title: "Dermal Glow Therapy",
      description: "Perawatan wajah mendalam dengan teknologi terkini untuk hidrasi dan regenerasi sel kulit secara alami.",
      icon: <Star className="w-6 h-6" />,
      tag: "Premium"
    },
    {
      title: "Nail Architecture",
      description: "Seni kuku dekoratif dan fungsional yang menggabungkan estetika modern dengan ketahanan material jangka panjang.",
      icon: <Award className="w-6 h-6" />,
      tag: "Creative"
    }
  ];

  const gallery = [
    "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=600",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&q=80&w=600"
  ];

  const team = [
    { name: "Sasha V.", role: "Lead Hair Stylist", image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=300" },
    { name: "Marco K.", role: "Color Specialist", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300" },
    { name: "Elena R.", role: "Skin Expert", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300" }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full"></div>
      </div>

      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tighter uppercase italic">Luminary Glow</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-widest text-gray-400">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#gallery" className="hover:text-white transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>

          <Link href="/register" className="hidden md:block px-6 py-2 bg-white text-black text-xs font-bold uppercase tracking-widest rounded-full hover:bg-purple-500 hover:text-white transition-all duration-300">
            Daftar Toko
          </Link>

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
            <a href="#about" onClick={() => setIsMenuOpen(false)}>About</a>
            <a href="#services" onClick={() => setIsMenuOpen(false)}>Services</a>
            <a href="#gallery" onClick={() => setIsMenuOpen(false)}>Gallery</a>
            <a href="#contact" onClick={() => setIsMenuOpen(false)}>Contact</a>
            <Link href="/register" onClick={() => setIsMenuOpen(false)} className="w-full py-4 bg-purple-600 rounded-xl font-bold text-center block">DAFTAR TOKO</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-[0.2em] mb-6 animate-pulse">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              The Future of Beauty is Here
            </div>
            <h1 className="text-6xl md:text-8xl font-black mb-8 leading-[0.9] tracking-tighter">
              BEYOND <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent italic">ESTHETICS</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-xl mb-10 leading-relaxed">
              Kami tidak hanya memotong rambut; kami merancang identitas. Sistem kasir, manajemen janji temu, dan notifikasi cerdas untuk salon modern.
            </p>
            
            <div className="flex flex-col gap-5 w-full max-w-md">
                <form onSubmit={handleLogin} className="flex flex-col sm:flex-row gap-3">
                    <input 
                        type="text" 
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="Slug Toko..." 
                        className="flex-1 bg-white/5 border border-white/10 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors placeholder-gray-500"
                        required
                    />
                    <button 
                        type="submit"
                        className="px-8 py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform group whitespace-nowrap"
                    >
                        MASUK
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>
                
                <div className="flex items-center gap-4 py-2">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Atau Gabung</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <Link href="/register" className="w-full px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-center hover:bg-white/10 transition-colors uppercase tracking-widest text-sm">
                    DAFTAR TOKO BARU
                </Link>
            </div>
            
            <div className="mt-16 flex gap-12 border-t border-white/10 pt-8">
              <div>
                <div className="text-3xl font-bold">12k+</div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">Happy Clients</div>
              </div>
              <div>
                <div className="text-3xl font-bold">15+</div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mt-1">Specialists</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded-[2rem] overflow-hidden border border-white/10 relative z-10 group">
              <img 
                src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800" 
                alt="Salon Hero"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
              <div className="absolute bottom-8 left-8 p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <p className="text-xs uppercase tracking-widest text-purple-400 mb-1">Editor's Choice</p>
                <p className="text-xl font-bold">Best Luxury Salon 2024</p>
              </div>
            </div>
            {/* Geometric accents */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/30 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/30 rounded-full blur-[80px] pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-6 bg-white/[0.02]">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tighter">
                ELEVATED <span className="text-purple-500 italic">EXPERIENCE</span>
              </h2>
              <p className="text-gray-400">
                Layanan kurasi yang dirancang khusus untuk memenuhi kebutuhan gaya hidup modern. Kami fokus pada kualitas, bukan kuantitas.
              </p>
            </div>
            <a href="#" className="text-sm font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:text-purple-500 transition-colors">
              Explore All <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, idx) => (
              <div key={idx} className="group p-8 bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 hover:border-purple-500/50 transition-all duration-500">
                <div className="mb-8 p-4 bg-white/5 rounded-2xl w-fit group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  {service.icon}
                </div>
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-purple-400 px-2 py-1 bg-purple-400/10 w-fit rounded-lg">
                  {service.tag}
                </div>
                <h3 className="text-xl font-bold mb-4">{service.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 italic">
                  "{service.description}"
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 group-hover:text-white transition-colors cursor-pointer">
                  KONSULTASI <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / Philosophy */}
      <section id="about" className="py-32 px-6">
        <div className="container mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="order-2 md:order-1 relative">
             <div className="aspect-square rounded-[3rem] overflow-hidden border border-white/10">
                <img 
                  src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800" 
                  alt="Interior" 
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                />
             </div>
             <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 hidden lg:block pointer-events-none">
                <div className="text-4xl font-black text-purple-500 mb-2">99%</div>
                <p className="text-[10px] uppercase font-bold tracking-widest leading-tight">Kepuasan Pelanggan Terhadap Detail Presisi</p>
             </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-5xl font-black mb-8 leading-tight uppercase tracking-tighter">
              TEKNOLOGI MEETS <br />
              <span className="italic text-gray-600">HANDCRAFTED BEAUTY</span>
            </h2>
            <div className="space-y-6 text-gray-400 leading-relaxed">
              <p>
                Di Luminary Glow, kami percaya bahwa setiap individu adalah sebuah karya seni yang unik. Visi kami adalah mengintegrasikan tren global dengan personalisasi mendalam.
              </p>
              <p>
                Setiap alat yang kami gunakan telah disterilisasi dengan standar medis, dan setiap produk yang kami pilih telah melalui uji klinis yang ketat untuk memastikan keamanan jangka panjang Anda.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-xs uppercase font-bold tracking-widest">Cruelty Free Products</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-xs uppercase font-bold tracking-widest">Expert Certified</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-xs uppercase font-bold tracking-widest">Hygienic Standard</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-xs uppercase font-bold tracking-widest">Modern Ambience</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-24 px-6 bg-white/[0.02]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 uppercase tracking-tighter">THE SHOWCASE</h2>
            <p className="text-gray-400">Bukti nyata dari setiap transformasi yang kami lakukan.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gallery.map((img, i) => (
              <div key={i} className={`relative overflow-hidden rounded-3xl group cursor-crosshair ${i % 2 !== 0 ? 'mt-8' : ''}`}>
                <img src={img} alt="Gallery" className="w-full h-full object-cover aspect-[3/4] group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-16">
            <h2 className="text-4xl font-black uppercase tracking-tighter">MEET THE <span className="italic text-purple-500">ARTISANS</span></h2>
            <div className="hidden md:flex items-center gap-2 text-gray-500">
               <Users className="w-5 h-5" />
               <span className="text-xs font-bold uppercase tracking-widest">Creative Collective</span>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <div key={i} className="group text-center">
                <div className="relative mb-6 mx-auto w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-2 border-white/5 p-2 group-hover:border-purple-500/50 transition-all duration-500">
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover rounded-full grayscale group-hover:grayscale-0 transition-all duration-500" />
                </div>
                <h3 className="text-2xl font-bold mb-1 tracking-tight">{member.name}</h3>
                <p className="text-xs text-purple-500 uppercase font-bold tracking-[0.2em]">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 border-t border-white/10">
        <div className="container mx-auto">
          <div className="bg-gradient-to-br from-white/10 to-transparent p-12 rounded-[3rem] border border-white/10 relative overflow-hidden">
            <div className="relative z-10 grid lg:grid-cols-2 gap-16">
              <div>
                <h2 className="text-5xl font-black mb-8 leading-tight tracking-tighter uppercase">READY FOR YOUR <br /><span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent italic">GLOW UP?</span></h2>
                <div className="space-y-8">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Our Studio</p>
                      <p className="text-lg">Jl. Kemang Raya No. 12, Jakarta Selatan, Indonesia</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Operating Hours</p>
                      <p className="text-lg">Setiap Hari: 10:00 — 20:00</p>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:bg-purple-500 hover:text-white transition-all cursor-pointer">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:bg-purple-500 hover:text-white transition-all cursor-pointer">
                      <Phone className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl">
                <h3 className="text-xl font-bold mb-6 italic underline decoration-purple-500 underline-offset-8">Kirim Pesan Cepat</h3>
                <form className="space-y-4">
                  <input type="text" placeholder="NAMA LENGKAP" className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-xs font-bold tracking-widest focus:outline-none focus:border-purple-500 transition-colors" />
                  <input type="email" placeholder="EMAIL ADDRESS" className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-xs font-bold tracking-widest focus:outline-none focus:border-purple-500 transition-colors" />
                  <textarea placeholder="APA YANG ANDA BUTUHKAN?" rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-xs font-bold tracking-widest focus:outline-none focus:border-purple-500 transition-colors"></textarea>
                  <button className="w-full py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl hover:bg-purple-600 hover:text-white transition-all">
                    KIRIM PERMINTAAN
                  </button>
                </form>
              </div>
            </div>
            {/* Background design */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold tracking-tighter uppercase italic text-gray-500">Luminary Glow © {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Artistry</a>
            <a href="#" className="hover:text-white">Careers</a>
          </div>
          <div className="text-[10px] text-gray-600 uppercase tracking-widest">
            Handcrafted with <span className="text-red-500">♥</span> for your beauty.
          </div>
        </div>
      </footer>
    </div>
  );
}
