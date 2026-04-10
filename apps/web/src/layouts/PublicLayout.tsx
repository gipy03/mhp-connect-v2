import { Outlet } from "@tanstack/react-router";
import { CompactFooter } from "@/components/Footer";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.15),transparent_70%)]" />
        <div className="relative flex flex-col justify-between p-10 xl:p-14 w-full">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              mhp{" "}
              <span className="text-white/50 font-light">|</span>{" "}
              connect
            </h1>
          </div>
          <div className="space-y-4">
            <p className="text-white/90 text-xl xl:text-2xl font-medium leading-snug max-w-md">
              Institut de formation OMNI Hypnose® Suisse romande
            </p>
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
