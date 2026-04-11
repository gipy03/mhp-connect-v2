import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t bg-background/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-tight">
              mhp{" "}
              <span className="text-muted-foreground font-light">|</span>{" "}
              connect
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              mhp | hypnose — OMNI Hypnose® Suisse romande & France, Centre de Formation en Hypnose Elmanienne.
              Plateforme de gestion des formations et communauté de praticiens.
            </p>
            <div className="pt-1">
              <img
                src="/swiss-made-software.png"
                alt="Swiss Made Software"
                className="h-8 object-contain opacity-70"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formation
            </p>
            <nav className="flex flex-col gap-1.5">
              <Link
                to="/catalogue"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Catalogue
              </Link>
              <Link
                to="/agenda"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Agenda
              </Link>
              <Link
                to="/annuaire"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Annuaire des praticiens
              </Link>
            </nav>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plateforme
            </p>
            <nav className="flex flex-col gap-1.5">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Créer un compte
              </Link>
            </nav>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </p>
            <nav className="flex flex-col gap-1.5">
              <a
                href="https://www.mhp-hypnose.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                mhp-hypnose.com
              </a>
              <a
                href="mailto:info@mhp-hypnose.com"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                info@mhp-hypnose.com
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t">
          <p className="text-[11px] text-muted-foreground text-center">
            &copy;{" "}
            <a href="https://www.mhp-hypnose.com/droits-auteur" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              mhp | hypnose – MHP &amp; Partners Sàrl
            </a>
            {" "}- Sauf mention contraire, le contenu de ce site est sous licence{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              CC BY 4.0
              <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt="CC" className="inline h-[14px] ml-0.5 align-text-bottom" />
              <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt="BY" className="inline h-[14px] ml-0.5 align-text-bottom" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function CompactFooter() {
  return (
    <footer className="py-4 text-center">
      <p className="text-[11px] text-muted-foreground">
        &copy;{" "}
        <a href="https://www.mhp-hypnose.com/droits-auteur" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          mhp | hypnose – MHP &amp; Partners Sàrl
        </a>
        {" "}- Sauf mention contraire, le contenu de ce site est sous licence{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          CC BY 4.0
          <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt="CC" className="inline h-[14px] ml-0.5 align-text-bottom" />
          <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt="BY" className="inline h-[14px] ml-0.5 align-text-bottom" />
        </a>
      </p>
    </footer>
  );
}
