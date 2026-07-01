import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Trophy,
    Users,
    BarChart3,
    MessageSquare,
    Wallet,
    Radio,
    Play,
    ArrowRight,
    Zap,
    Shield,
    Globe,
    ChevronDown,
    Phone,
    Gavel,
} from "lucide-react";
import logo from "../assets/logo.png";

// Animation variants
const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 0.6 },
};

const fadeIn = {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true },
    transition: { duration: 0.8 },
};

const scaleIn = {
    initial: { opacity: 0, scale: 0.8 },
    whileInView: { opacity: 1, scale: 1 },
    viewport: { once: true },
    transition: { duration: 0.5 },
};

const staggerContainer = {
    initial: {},
    whileInView: {
        transition: { staggerChildren: 0.1 },
    },
    viewport: { once: true },
};

const staggerItem = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
};

// Features data optimized for SEO
const features = [
    {
        icon: Trophy,
        title: "Live Cricket Auction Software",
        description:
            "Conduct seamless IPL-style player auctions with real-time bidding, automatic slab increments, and instant team purse updates.",
        color: "text-primary",
        glow: "group-hover:shadow-[0_0_30px_hsl(263,70%,50%,0.3)]",
    },
    {
        icon: Users,
        title: "Player & Team Management",
        description:
            "Bulk upload players via CSV, let teams self-register via a shareable link, sync with Google Sheets, and export rosters as CSV or PDF.",
        color: "text-secondary",
        glow: "group-hover:shadow-[0_0_30px_hsl(30,100%,55%,0.3)]",
    },
    {
        icon: BarChart3,
        title: "Real-time Auction Analytics",
        description:
            "Track unsold players, budget consumption, and team strength with our comprehensive live auction dashboard.",
        color: "text-accent",
        glow: "group-hover:shadow-[0_0_30px_hsl(142,76%,36%,0.3)]",
    },
    {
        icon: MessageSquare,
        title: "WhatsApp Player Notifications",
        description:
            "Instantly notify players on WhatsApp the moment they are sold or unsold — with their team name and sale amount. Zero manual messaging.",
        color: "text-green-400",
        glow: "group-hover:shadow-[0_0_30px_hsl(142,76%,50%,0.3)]",
    },
    {
        icon: Wallet,
        title: "Automated Budget Tracking",
        description:
            "Prevent overspending with automatic purse calculations. The system enforces budget limits for every team in real-time.",
        color: "text-yellow-400",
        glow: "group-hover:shadow-[0_0_30px_hsl(45,100%,50%,0.3)]",
    },
    {
        icon: Radio,
        title: "OBS Live Streaming Overlays",
        description:
            "Stream your auction on YouTube or Facebook with built-in OBS browser sources — Camera HUD, fullscreen scoreboard, and split-screen layouts.",
        color: "text-red-400",
        glow: "group-hover:shadow-[0_0_30px_hsl(0,80%,60%,0.3)]",
    },
];

// How it works steps
const steps = [
    {
        number: "01",
        title: "Create Your Cricket Tournament",
        description: "Set up teams, total purse budget, and define player categories for your auction.",
    },
    {
        number: "02",
        title: "Register Players",
        description: "Use our bulk upload feature to add hundreds of players instantly from CSV.",
    },
    {
        number: "03",
        title: "Run Live Auction",
        description: "Launch the live bidding screen. Teams bid, and system handles calculations.",
    },
    {
        number: "04",
        title: "Export & Share Results",
        description: "Download team rosters as PDF, export data to CSV, sync results back to Google Sheets, and share with everyone instantly.",
    },
];

// Stats
const stats = [
    { value: "500+", label: "Tournaments Managed" },
    { value: "10K+", label: "Players Auctioned" },
    { value: "100%", label: "Paperless Logic" },
    { value: "4.9★", label: "Organizer Rating" },
];

export default function Home() {
    const navigate = useNavigate();
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"],
    });

    const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
    const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
    const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

    useEffect(() => {
        document.title = "Vardhaman CricBid — India's #1 Cricket Auction Software | IPL-Style Live Player Bidding App";

        const setMeta = (name: string, content: string, prop = false) => {
            const attr = prop ? `property` : `name`;
            let tag = document.querySelector(`meta[${attr}="${name}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute(attr, name);
                document.head.appendChild(tag);
            }
            tag.setAttribute('content', content);
        };

        setMeta('description', "India's #1 cricket auction software — automatic smart bidding, WhatsApp player notifications, OBS live streaming overlays & Google Sheets sync. Best IPL-style online auction app for box cricket, gully cricket, colony & corporate tournaments across Mumbai, Pune, Delhi, Hyderabad & all India.");
        setMeta('keywords', "cricket auction software, cricket auction app india, online cricket auction, IPL auction software, live cricket auction, automatic cricket auction, smart auction software, whatsapp cricket notification, OBS cricket streaming, box cricket auction, gully cricket auction, corporate cricket auction, cricket player bidding, cricket tournament software india");
    }, []);

    return (
        <div className="overflow-hidden font-sans">
            {/* Landing Page Header */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-white rounded-lg shadow-glow overflow-hidden flex items-center justify-center">
                            <img src={logo} alt="Vardhaman CricBid — India's #1 Cricket Auction Software" className="h-10 w-[160px] object-contain scale-[2.1]" />
                        </div>
                    </div>
                    <div>
                        <Button onClick={() => navigate("/tournaments")}>Take me to CricBid</Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <motion.section
                ref={heroRef}
                className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
                style={{ opacity: heroOpacity }}
            >
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-48 h-48 md:w-96 md:h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 md:w-96 md:h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />
                </div>

                {/* Grid Pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: "50px 50px",
                    }}
                />

                <motion.div
                    className="relative z-10 container mx-auto px-4 text-center"
                    style={{ y: heroY, scale: heroScale }}
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
                    >
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">India's #1 Cricket Auction Software · Trusted by 500+ Organizers</span>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black mb-4 md:mb-6 leading-tight px-2"
                    >
                        <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                            India's #1 IPL-Style
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                            Cricket Auction Software
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-10 px-4"
                    >
                        Run IPL-style cricket player auctions with automatic smart bidding, instant WhatsApp notifications &amp; OBS live streaming. For box cricket, gully cricket, colony &amp; corporate tournaments across India.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
                    >
                        <Button
                            size="lg"
                            className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-[0_0_30px_hsl(263,70%,50%,0.4)] hover:shadow-[0_0_40px_hsl(263,70%,50%,0.6)] transition-all duration-300"
                            onClick={() => navigate("/tournaments")}
                        >
                            Take me to CricBid
                            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-primary/30 hover:bg-primary/10"
                            onClick={() => {
                                document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
                            }}
                        >
                            <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                            See Demo
                        </Button>
                    </motion.div>

                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                        className="mt-8 md:mt-10"
                    >
                        <p className="text-sm text-muted-foreground mb-3">Contact Us</p>
                        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-3">
                            <a
                                href="https://wa.me/918208216407"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium text-sm">Pushkar Sancheti: 8208216407</span>
                            </a>
                            <a
                                href="https://wa.me/919423931031"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium text-sm">Dr. Kartik Bakliwal: 9423931031</span>
                            </a>
                            <a
                                href="https://wa.me/919309848331"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4" />
                                <span className="font-medium text-sm">Prajyot Sancheti: 9309848331</span>
                            </a>
                        </div>
                    </motion.div>

                    {/* Scroll Indicator */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2"
                    >
                        <motion.div
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-muted-foreground"
                        >
                            <ChevronDown className="w-8 h-8" />
                        </motion.div>
                    </motion.div>
                </motion.div>
            </motion.section>

            {/* App Showcase Section */}
            <section id="demo" className="py-16 md:py-24 relative">
                <div className="container mx-auto px-4">
                    <motion.div {...fadeInUp} className="text-center mb-8 md:mb-12">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 md:mb-4">
                            See the <span className="text-primary">Auction App</span> in Action
                        </h2>
                        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                            Experience the thrill of a digital cricket player auction.
                        </p>
                    </motion.div>

                    <motion.div {...staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
                        <motion.div {...staggerItem}>
                            <Card className="overflow-hidden bg-card/50 backdrop-blur border-primary/20 shadow-xl hover:border-primary/40 hover:shadow-[0_0_30px_hsl(263,70%,50%,0.2)] transition-all duration-300 h-full">
                                <CardContent className="p-0">
                                    <div className="aspect-video bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center relative">
                                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
                                        <div className="relative z-10 text-center space-y-3 px-4">
                                            <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                                                <Gavel className="h-8 w-8 text-primary" />
                                            </div>
                                            <p className="font-bold text-lg">Live Auction Room</p>
                                            <p className="text-sm text-muted-foreground">Real-time bidding with all teams. Automatic slab increments and instant purse updates.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...staggerItem}>
                            <Card className="overflow-hidden bg-card/50 backdrop-blur border-secondary/20 shadow-xl hover:border-secondary/40 hover:shadow-[0_0_30px_hsl(30,100%,55%,0.2)] transition-all duration-300 h-full">
                                <CardContent className="p-0">
                                    <div className="aspect-video bg-gradient-to-br from-secondary/20 via-secondary/10 to-background flex items-center justify-center relative">
                                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
                                        <div className="relative z-10 text-center space-y-3 px-4">
                                            <div className="w-16 h-16 rounded-2xl bg-secondary/20 border border-secondary/30 flex items-center justify-center mx-auto">
                                                <Users className="h-8 w-8 text-secondary" />
                                            </div>
                                            <p className="font-bold text-lg">Player Management</p>
                                            <p className="text-sm text-muted-foreground">Add, categorize and manage players. Bulk upload hundreds via CSV in seconds.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...staggerItem}>
                            <Card className="overflow-hidden bg-card/50 backdrop-blur border-accent/20 shadow-xl hover:border-accent/40 hover:shadow-[0_0_30px_hsl(142,76%,36%,0.2)] transition-all duration-300 h-full">
                                <CardContent className="p-0">
                                    <div className="aspect-video bg-gradient-to-br from-accent/20 via-accent/10 to-background flex items-center justify-center relative">
                                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
                                        <div className="relative z-10 text-center space-y-3 px-4">
                                            <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto">
                                                <Trophy className="h-8 w-8 text-accent" />
                                            </div>
                                            <p className="font-bold text-lg">Team Rosters</p>
                                            <p className="text-sm text-muted-foreground">Track budgets and squad composition. Export rosters as PDF or CSV instantly.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 md:py-24 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

                <div className="container mx-auto px-4 relative z-10">
                    <motion.div {...fadeInUp} className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 md:mb-4">
                            Why Choose <span className="text-secondary">Vardhaman cricBid</span>?
                        </h2>
                        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                            The most feature-rich online cricket auction software for organizers.
                        </p>
                    </motion.div>

                    <motion.div
                        {...staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {features.map((feature, index) => (
                            <motion.div key={index} {...staggerItem}>
                                <Card
                                    className={`group h-full bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all duration-500 ${feature.glow}`}
                                >
                                    <CardContent className="p-6">
                                        <div
                                            className={`w-14 h-14 rounded-xl bg-gradient-to-br from-card to-card/50 border border-border/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                                        >
                                            <feature.icon className={`w-7 h-7 ${feature.color}`} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-16 md:py-24 relative overflow-hidden">
                <div className="container mx-auto px-4">
                    <motion.div {...fadeInUp} className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 md:mb-4">
                            How the <span className="text-accent">Online Auction</span> Works
                        </h2>
                        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                            Host your cricket auction in 4 simple steps
                        </p>
                    </motion.div>

                    <div className="max-w-4xl mx-auto">
                        <div className="relative">
                            {/* Timeline Line */}
                            <div className="absolute left-6 sm:left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-secondary to-accent" />

                            {steps.map((step, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.15 }}
                                    className={`relative flex items-center mb-8 md:mb-12 ${index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                                        }`}
                                >
                                    {/* Step Number */}
                                    <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-lg sm:text-2xl font-black shadow-[0_0_30px_hsl(263,70%,50%,0.4)] z-10">
                                        {step.number}
                                    </div>

                                    {/* Content */}
                                    <div
                                        className={`ml-16 sm:ml-24 md:ml-0 md:w-1/2 ${index % 2 === 0 ? "md:pr-16 md:text-right" : "md:pl-16"
                                            }`}
                                    >
                                        <Card className="bg-card/50 backdrop-blur border-border/50">
                                            <CardContent className="p-4 sm:p-6">
                                                <h3 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">{step.title}</h3>
                                                <p className="text-sm sm:text-base text-muted-foreground">{step.description}</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>


            {/* Trust Badges */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <motion.div
                        {...fadeIn}
                        className="flex flex-wrap justify-center items-center gap-8 opacity-60"
                    >
                        <div className="flex items-center gap-2">
                            <Shield className="w-6 h-6" />
                            <span className="font-medium">Secure & Private</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe className="w-6 h-6" />
                            <span className="font-medium">Works Everywhere</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="w-6 h-6" />
                            <span className="font-medium">Real-time Sync</span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* FAQ Section - SEO Rich Content */}
            <section className="py-16 md:py-24 bg-card/30">
                <div className="container mx-auto px-4">
                    <motion.div {...fadeInUp} className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 md:mb-4">
                            Frequently Asked <span className="text-primary">Questions</span>
                        </h2>
                        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                            Everything you need to know about our Vardhaman cricBid
                        </p>
                    </motion.div>

                    <div className="max-w-4xl mx-auto space-y-4">

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">What is the pricing for Vardhaman CricBid?</h3>
                                    <p className="text-muted-foreground">Vardhaman CricBid offers very competitive and flexible pricing tailored to your needs. If you just need the essentials — live bidding, player management, and team tracking — the basic plan is extremely affordable. For organizers who want premium features like WhatsApp notifications, OBS live streaming overlays, and Google Sheets sync, those are available at an additional price. You only pay for what you actually use.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">What makes this a smart automatic auction software?</h3>
                                    <p className="text-muted-foreground">Our smart auction software automatically calculates bid increments based on custom slabs, tracks team budgets in real-time, enforces player limits, prevents overspending, and sends automatic WhatsApp notifications to players when they're sold or unsold — eliminating all manual calculations and human errors.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Does CricBid support live streaming overlays for OBS?</h3>
                                    <p className="text-muted-foreground">Yes! CricBid includes built-in OBS browser source overlays — Camera HUD, fullscreen scoreboard, and split-screen layouts. Add them as Browser Sources in OBS Studio and stream your cricket auction live on YouTube, Facebook, or any platform with zero extra setup.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Can I use this for box cricket, gully cricket, or corporate auctions?</h3>
                                    <p className="text-muted-foreground">Absolutely! Our cricket auction software works for all types — box cricket auctions, gully cricket auctions, corporate cricket leagues, colony cricket tournaments, and professional local tournaments. It's flexible enough to handle any cricket player auction format.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">How does WhatsApp cricket auction notification work?</h3>
                                    <p className="text-muted-foreground">Our WhatsApp integration automatically sends personalized messages to players the moment they are sold or remain unsold. Players receive instant notifications with their team name and sold amount — no manual messaging required. This is a unique feature of our cricket auction app.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Is Vardhaman CricBid the best online cricket auction software?</h3>
                                    <p className="text-muted-foreground">Vardhaman CricBid is rated 4.9★ by tournament organizers across India. With live bidding, automatic budget tracking, bulk player upload, OBS streaming overlays, WhatsApp integration, Google Sheets sync, and CSV/PDF export — it's widely considered the best and most feature-rich cricket auction platform available online.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Can I bulk upload cricket players from Excel or CSV?</h3>
                                    <p className="text-muted-foreground">Yes! CricBid supports bulk player upload via CSV file. Upload hundreds of players at once with their names, base prices, categories, mobile numbers, and photos. This saves hours of manual data entry and gets your cricket auction ready in minutes — perfect for large tournaments with 100+ players.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Does CricBid work on mobile phones?</h3>
                                    <p className="text-muted-foreground">Yes! Vardhaman CricBid is fully mobile-responsive and works on all smartphones, tablets, and laptops. The auction host manages from a laptop while team owners can bid from their phones. No app download required — it works directly in any mobile browser. Perfect for WhatsApp-connected cricket groups across India.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Does CricBid also include cricket scoring and live scorecards?</h3>
                                    <p className="text-muted-foreground">Yes! CricBid now includes CricScoring at <a href="https://scoring.cricbid.online" className="text-primary hover:underline">scoring.cricbid.online</a> — a free ball-by-ball cricket scoring app. Score matches live, track batsman and bowler stats, show real-time scorecards to spectators, and build match schedules for your tournament. Auction data and player rosters sync automatically from CricBid.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Which cities in India use Vardhaman CricBid?</h3>
                                    <p className="text-muted-foreground">CricBid is used by cricket tournament organizers across India — Mumbai, Pune, Nagpur, Delhi, Hyderabad, Bangalore, Chennai, Kolkata, Ahmedabad, Surat, Jaipur, Nashik, Aurangabad, and hundreds of smaller towns. Any cricket organizer in India can use our online platform to run an IPL-style player auction.</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-16 md:py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-primary/20 rounded-full blur-3xl" />

                <motion.div {...scaleIn} className="container mx-auto px-4 relative z-10 text-center">
                    <h2 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 md:mb-6 px-2">
                        Start Your
                        <br />
                        <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Cricket Auction
                        </span>
                        {" "}Today
                    </h2>
                    <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 md:mb-10 px-4">
                        Join hundreds of tournament organizers who trust Vardhaman cricBid for their player auctions.
                    </p>

                    {/* Contact Info */}
                    <div className="flex flex-col items-center justify-center gap-4 mb-8">
                        <h3 className="text-xl font-semibold text-muted-foreground mb-2">Contact Us</h3>
                        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
                            <a
                                href="https://wa.me/918208216407"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="font-semibold text-sm sm:text-base">Pushkar Sancheti: 8208216407</span>
                            </a>
                            <a
                                href="https://wa.me/919423931031"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="font-semibold text-sm sm:text-base">Dr. Kartik Bakliwal: 9423931031</span>
                            </a>
                            <a
                                href="https://wa.me/919309848331"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-all text-green-500"
                            >
                                <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="font-semibold text-sm sm:text-base">Prajyot Sancheti: 9309848331</span>
                            </a>
                        </div>
                    </div>

                    <Button
                        size="lg"
                        className="text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_40px_hsl(263,70%,50%,0.4)] hover:shadow-[0_0_60px_hsl(263,70%,50%,0.6)] transition-all duration-300"
                        onClick={() => navigate("/tournaments")}
                    >
                        Create Your Auction
                        <ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="py-8 md:py-12 border-t border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img src={logo} alt="Vardhaman CricBid Cricket Auction Software" className="w-8 h-8 rounded-md" />
                            <span className="text-xl font-bold">Vardhaman cricBid</span>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-muted-foreground">
                            <a href="#demo" className="hover:text-primary transition-colors">How it works</a>
                            <a href="https://scoring.cricbid.online" className="hover:text-primary transition-colors" rel="noopener">Cricket Scoring</a>
                            <a href="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</a>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <a href="tel:+918208216407" className="hover:text-primary transition-colors">+91-8208216407</a>
                            </div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                            © {new Date().getFullYear()} Vardhaman CricBid. India's #1 Cricket Auction Software. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
