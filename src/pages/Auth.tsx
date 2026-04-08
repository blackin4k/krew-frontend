import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, Mail, Lock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const response = await authApi.login(formData.username, formData.password);
        const token = response.data.token || response.data;
        login(token, { username: formData.username });
        toast({ title: 'Welcome back!' });
        navigate('/');
      } else {
        await authApi.register(formData.username, formData.email, formData.password);
        toast({ title: 'Account created! Please log in.' });
        setIsLogin(true);
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || 'Authentication failed';
      toast({
        title: 'Error',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[390px]"
      >
        {/* NAME*/}
        <div className="flex flex-col items-center mb-1">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">KREW</h1>
        </div>

        {/* Form Card */}
        <div className="bg-[#121212] border border-white/5 rounded-[38px] p-8 shadow-2xl relative overflow-hidden">

          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold mb-2 text-white">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-[15px] text-[#9CA3AF]">
              {isLogin ? 'Enter your details below' : 'Join the Krew today'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20 transition-all"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-5"
                >
                  <div className="relative mt-5">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20 transition-all"
                      required={!isLogin}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20 transition-all"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 mt-8 rounded-[22px] bg-white hover:bg-white/90 text-black font-semibold text-[16px] shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                isLogin ? 'Sign In' : 'Register'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-[14px]">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#9CA3AF] hover:text-white transition-colors font-medium"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                {isLogin ? 'Sign Up' : 'Sign In'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
