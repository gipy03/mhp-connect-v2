import { Outlet } from "@tanstack/react-router";
import { CompactFooter } from "@/components/Footer";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden">
        <img src="/login-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative flex flex-col justify-between p-10 xl:p-14 w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              mhp{" "}
              <span className="text-white/50 font-light">|</span>{" "}
              connect
            </h1>
          </div>
          <div className="flex flex-col items-start gap-6">
            <img
              src="/logo-mhp-rond-white.png"
              alt="MHP Hypnose — Centre de Formation"
              className="w-40 xl:w-48 h-auto"
            />
            <p className="text-white/60 text-sm leading-relaxed max-w-sm">
              Accédez à votre espace membre, gérez vos formations et rejoignez notre communauté de praticiens.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <img
              src="/swiss-made-software.png"
              alt="Swiss Made Software"
              className="h-8 object-contain opacity-70 brightness-0 invert"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-sm animate-page-enter">
            <div className="mb-8 text-center lg:hidden">
              <h1 className="text-lg font-semibold tracking-tight">
                mhp{" "}
                <span className="text-muted-foreground font-light">|</span>{" "}
                connect
              </h1>
            </div>

            <Outlet />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pb-6">
          <img
            src="/swiss-made-software.png"
            alt="Swiss Made Software"
            className="h-10 object-contain opacity-80 lg:hidden"
          />
          <CompactFooter />
        </div>
      </div>
    </div>
  );
}
