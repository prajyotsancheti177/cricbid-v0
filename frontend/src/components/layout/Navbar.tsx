import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Trophy, LogOut, User, Menu, X, Phone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/eventTracker";
import { getSocket } from "@/lib/socket";
import logo from "@/assets/logo.png";

// Public links shown in the main bar for everyone
const PUBLIC_LINKS = [
  { path: "/", label: "Home" },
  { path: "/tournaments", label: "Tournaments" },
  { path: "/auction", label: "Live Auction" },
];

// Admin/account links — tucked into the right-side account menu (and the mobile
// menu). Built from the logged-in user's role.
const buildAdminLinks = () => {
  const links: { path: string; label: string }[] = [];
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return links;
    const user = JSON.parse(userStr);

    // Authenticated users manage tournaments
    links.push({ path: "/tournaments/manage", label: "Manage Tournaments" });
    links.push({ path: "/add-player", label: "Add Player" });

    if (user.role === 'tournament_host' || user.role === 'super_user' || user.role === 'boss') {
      links.push({ path: "/bulk-upload", label: "Bulk Upload" });
    }
    if (user.role === 'boss' || user.role === 'super_user') {
      links.push({ path: "/users", label: "Users" });
      // Analytics hidden pending SQL migration (aggregation pipelines not yet ported)
      // links.push({ path: "/analytics", label: "Analytics" });
    }
  } catch {
    // ignore localStorage errors
  }
  return links;
};

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasLiveAuction, setHasLiveAuction] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Listen for active auctions via socket
  useEffect(() => {
    const socket = getSocket();

    const onListUpdate = (list: any[]) => {
      setHasLiveAuction(list.length > 0);
    };

    const onConnect = () => {
      socket.emit("auction:list");
    };

    if (socket.connected) {
      socket.emit("auction:list");
    } else {
      socket.connect();
    }

    socket.on("connect", onConnect);
    socket.on("auction:list", onListUpdate);

    // Poll periodically
    const interval = setInterval(() => {
      if (socket.connected) socket.emit("auction:list");
    }, 10000);

    return () => {
      socket.off("connect", onConnect);
      socket.off("auction:list", onListUpdate);
      clearInterval(interval);
    };
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    // Track logout event before clearing user data
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      trackEvent("logout", { userId: user._id, role: user.role });
    }

    localStorage.removeItem("user");
    localStorage.removeItem("isAuthenticated");
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    setMobileMenuOpen(false);
    navigate("/tournaments"); // Redirect to public page instead of login
  };

  const getUserName = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.name;
      }
    } catch {
      return null;
    }
    return null;
  };

  const userName = getUserName();
  const publicLinks = PUBLIC_LINKS;
  const adminLinks = buildAdminLinks();
  const mobileLinks = [...publicLinks, ...adminLinks];

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto px-3">
        <div className="flex h-14 md:h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/tournaments" className="flex items-center gap-2 group">
            <div className="bg-white rounded-lg shadow-glow transition-transform group-hover:scale-105 overflow-hidden flex items-center justify-center">
              <img
                src={logo}
                alt="Vardhaman cricBid"
                className="h-7 md:h-14 w-[110px] md:w-[200px] object-contain scale-[2.1]"
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex gap-1">
              {publicLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium text-base transition-all whitespace-nowrap relative",
                    location.pathname === link.path
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    link.path === "/auction" && hasLiveAuction && location.pathname !== "/auction"
                    && "bg-red-500/10 text-red-500 hover:bg-red-500/20 ring-1 ring-red-500/30 animate-pulse"
                  )}
                >
                  {link.path === "/auction" && hasLiveAuction && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  )}
                  {link.label}
                </Link>
              ))}
            </div>

            {userName ? (
              <div className="flex items-center gap-2 border-l pl-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      <span className="max-w-[140px] truncate">{userName}</span>
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">{userName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {adminLinks.map((link) => (
                      <DropdownMenuItem key={link.path} onClick={() => navigate(link.path)}>
                        {link.label}
                      </DropdownMenuItem>
                    ))}
                    {adminLinks.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l pl-4">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile: Quick Links + Hamburger */}
          <div className="flex md:hidden items-center gap-1">
            {/* Quick access links visible on mobile */}
            <Link
              to="/tournaments"
              className={cn(
                "px-2 py-1.5 rounded-md font-medium text-xs transition-all whitespace-nowrap",
                location.pathname === "/tournaments"
                  ? "bg-gradient-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tournaments
            </Link>
            <Link
              to="/auction"
              className={cn(
                "px-2 py-1.5 rounded-md font-medium text-xs transition-all whitespace-nowrap relative",
                location.pathname === "/auction"
                  ? "bg-gradient-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                hasLiveAuction && location.pathname !== "/auction"
                && "bg-red-500/10 text-red-500 ring-1 ring-red-500/30 animate-pulse"
              )}
            >
              {hasLiveAuction && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
              Live Auction
            </Link>

            {/* Hamburger Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8 ml-1"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Contains all navigation and Login/Logout */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/80 backdrop-blur-2xl h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="container mx-auto px-3 py-4 pb-20">
            <div className="flex flex-col gap-2">
              {mobileLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={cn(
                    "px-4 py-3 rounded-lg font-medium text-left transition-all relative",
                    location.pathname === link.path
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    link.path === "/auction" && hasLiveAuction && location.pathname !== "/auction"
                    && "bg-red-500/10 text-red-500 hover:bg-red-500/20 ring-1 ring-red-500/30"
                  )}
                >
                  {link.path === "/auction" && hasLiveAuction && (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
                  {link.label}
                </button>
              ))}

              {/* Login/Logout in hamburger menu */}
              <div className="mt-2 pt-2 border-t border-border">
                {userName ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Logged in as {userName}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 rounded-lg font-medium text-left transition-all text-destructive hover:bg-destructive/10 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleNavClick("/login")}
                    className="w-full px-4 py-3 rounded-lg font-medium text-left transition-all bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    <span>Login</span>
                  </button>
                )}
              </div>

              {/* Contact Us in hamburger menu */}
              <div className="mt-2 pt-2 border-t border-border">
                <p className="px-4 py-2 text-sm text-muted-foreground">Contact Us</p>
                <div className="flex flex-col gap-2">
                  <a
                    href="https://wa.me/918208216407"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-green-500 hover:bg-green-500/10 transition-all"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">Pushkar Sancheti: 8208216407</span>
                  </a>
                  <a
                    href="https://wa.me/919423931031"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-green-500 hover:bg-green-500/10 transition-all"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">Dr. Kartik Bakliwal: 9423931031</span>
                  </a>
                  <a
                    href="https://wa.me/919309848331"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-green-500 hover:bg-green-500/10 transition-all"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">Prajyot Sancheti: 9309848331</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
