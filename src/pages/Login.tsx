import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Mail, Lock, UserPlus, LogIn, Ghost, Loader2 } from 'lucide-react';

const translateAuthError = (err: any): string => {
  if (!err) return "";
  const code = err.code || "";
  const message = err.message || "";
  const lowercaseMsg = message.toLowerCase();

  // Domain unauthorized
  if (code === 'auth/unauthorized-domain' || 
      lowercaseMsg.includes('unauthorized-domain') || 
      lowercaseMsg.includes('authorized-domain') || 
      lowercaseMsg.includes('domain')) {
    return `Erro de Domínio: O domínio "${window.location.hostname}" precisa ser adicionado aos "Domínios Autorizados" no Console Firebase (Authentication > Configurações > Domínios Autorizados) do projeto "weaura-390c7" para que o login funcione.`;
  }

  // Popup blocked
  if (code === 'auth/popup-blocked' || 
      lowercaseMsg.includes('popup-blocked') || 
      lowercaseMsg.includes('popup blocked')) {
    return "Janela Bloqueada: O navegador bloqueou o popup do Google. Clique para abrir WeAura em uma nova aba fora do editor para fazer login.";
  }

  // Popup closed
  if (code === 'auth/popup-closed-by-user' || 
      lowercaseMsg.includes('popup-closed-by-user') || 
      lowercaseMsg.includes('closed by user')) {
    return "Tentativa de login cancelada. A janela de autenticação foi fechada antes da conclusão.";
  }

  // Operation not allowed
  if (code === 'auth/operation-not-allowed' || 
      lowercaseMsg.includes('operation-not-allowed') || 
      lowercaseMsg.includes('restricted-operation')) {
    return "Serviço Inativo: O login com Google ou E-mail não está ativo no Console do Firebase. Ative em 'Authentication > Sign-in method'.";
  }

  // Credentials
  if (code === 'auth/wrong-password' || 
      code === 'auth/invalid-credential' || 
      lowercaseMsg.includes('invalid-credential') || 
      lowercaseMsg.includes('wrong-password') || 
      lowercaseMsg.includes('auth/invalid-email')) {
    return "E-mail ou Código Aura incorretos. Verifique seus dados do WeAura e tente de novo.";
  }

  if (code === 'auth/user-not-found' || 
      lowercaseMsg.includes('user-not-found')) {
    return "Nenhum iniciado encontrado com este e-mail. Ative 'Novo Iniciado? Registrar' para se cadastrar.";
  }

  if (code === 'auth/email-already-in-use' || 
      lowercaseMsg.includes('email-already-in-use')) {
    return "Este e-mail de elite já está cadastrado. Altere para 'Entrar' e use o seu Código Aura.";
  }

  if (code === 'auth/weak-password' || 
      lowercaseMsg.includes('weak-password')) {
    return "Código Aura fraco. Escolha uma senha segura de pelo menos 6 dígitos.";
  }

  if (code === 'auth/too-many-requests' || 
      lowercaseMsg.includes('too-many-requests')) {
    return "Muitas tentativas. Acesso bloqueado temporariamente por segurança. Aguarde um momento e tente de novo.";
  }

  if (code === 'auth/network-request-failed' || 
      lowercaseMsg.includes('network-request-failed')) {
    return "Erro de Rede: Conexão instável. Verifique sua internet.";
  }

  return message || "Ocorreu um erro ao realizar a autenticação.";
};

export default function Login() {
  const { loginAnonymously, loginWithEmail, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try { 
      await loginWithEmail(email, password, isRegister); 
    } catch (err: any) { 
      console.error("Login email error:", err);
      setError(translateAuthError(err)); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try { 
      await loginWithGoogle(); 
    } catch (err: any) { 
      console.error("Google Auth error:", err);
      setError(translateAuthError(err));
    } finally { 
      setLoading(false); 
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    setError(null);
    try { 
      await loginAnonymously(); 
    } catch (err: any) { 
      console.error("Guest Auth error:", err);
      setError(translateAuthError(err)); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center p-8 relative overflow-hidden">
      {/* Ultra Premium Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-purple-600/[0.08] blur-[150px] rounded-full animate-pulse" />
         <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/[0.06] blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
         <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020202]/50 to-[#020202]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="inline-flex p-1 rounded-[32px] bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 mb-8 shadow-2xl backdrop-blur-3xl"
          >
            <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-[#020202] shadow-[0_10px_30px_rgba(255,255,255,0.2)]">
               <LogIn size={32} />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-black uppercase tracking-[0.25em] text-white leading-none italic">
            We<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Aura</span>
          </h1>
          <p className="text-white/20 text-[11px] font-black uppercase tracking-[0.4em] mt-4 italic opacity-80">Conexão • Elite • Digital</p>
        </div>

        <div className="space-y-8">
          <div className="glass-dark border border-white/[0.08] rounded-[50px] p-10 shadow-premium space-y-8 relative card-shine overflow-hidden">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase text-center tracking-widest italic"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/5 group-focus-within:text-purple-500 transition-all duration-500">
                    <Mail size={20} className="drop-shadow-[0_0_8px_currentColor]" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail de Elite"
                    className="w-full bg-black/60 border border-white/[0.08] rounded-[24px] py-5 pl-16 pr-8 text-white text-[15px] font-bold outline-none focus:border-purple-500/30 focus:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all italic placeholder:text-white/10"
                    required
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-white/5 group-focus-within:text-purple-500 transition-all duration-500">
                    <Lock size={20} className="drop-shadow-[0_0_8px_currentColor]" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Código Aura"
                    className="w-full bg-black/60 border border-white/[0.08] rounded-[24px] py-5 pl-16 pr-8 text-white text-[15px] font-bold outline-none focus:border-purple-500/30 focus:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all italic placeholder:text-white/10"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-white text-[#020202] rounded-[24px] font-black uppercase tracking-[0.25em] text-[12px] flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(255,255,255,0.15)] active:scale-95 disabled:opacity-50 transition-all hover:scale-[1.02] italic card-shine"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : (isRegister ? 'Criar Identidade' : 'Acessar Aura')}
              </button>
            </form>

            <div className="flex items-center gap-6 py-2 opacity-10">
               <div className="flex-1 h-px bg-white"></div>
               <span className="text-[9px] font-black uppercase tracking-[0.5em] text-white">OR</span>
               <div className="flex-1 h-px bg-white"></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="flex h-14 items-center justify-center gap-3 bg-white/5 border border-white/[0.08] rounded-[22px] text-[10px] font-black uppercase text-white tracking-[0.1em] hover:bg-white hover:text-black transition-all active:scale-95 shadow-xl italic"
              >
                 <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" className="w-5 h-5" alt="" />
                 Google
              </button>

              <button
                onClick={handleGuest}
                disabled={loading}
                className="flex h-14 items-center justify-center gap-3 bg-white/5 border border-white/[0.08] rounded-[22px] text-[10px] font-black uppercase text-white tracking-[0.1em] hover:bg-white hover:text-black transition-all active:scale-95 shadow-xl italic"
              >
                <Ghost size={18} />
                Furtivo
              </button>
            </div>

            {window.self !== window.top && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  ℹ️ DICA DO EDITOR
                </p>
                <p className="text-[8px] font-medium text-white/50 leading-relaxed mt-1">
                  Se você estiver usando o Google/Gmail dentro do visualizador do AI Studio, use o botão <strong className="text-white">"Abrir em nova guia"</strong> acima para permitir que o navegador abra o popup com segurança.
                </p>
              </motion.div>
            )}
          </div>

          <button
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-[11px] font-black uppercase text-white/20 hover:text-white transition-all tracking-[0.3em] italic"
          >
            {isRegister ? 'Aura Existente? Entrar' : 'Novo Iniciado? Registrar'}
          </button>
        </div>
        
        <div className="mt-20 text-center space-y-4">
           <p className="text-[10px] font-black text-white/5 uppercase tracking-[0.5em] italic">
             Protocolo We Aura • v2.8.0 Premium
           </p>
           <div className="flex justify-center gap-6 opacity-20">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
