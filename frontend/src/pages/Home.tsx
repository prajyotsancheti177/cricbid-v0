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
    Target,
    Play,
    ArrowRight,
    Zap,
    Shield,
    Globe,
    ChevronDown,
    Phone,
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
            "Manage your cricket tournament roster with bulk uploads, player categorization, and detailed team profiles.",
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
        title: "WhatsApp Status Updates",
        description:
            "Our auction app sends automatic WhatsApp notifications to players as soon as they are sold or remain unsold.",
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
        icon: Target,
        title: "Flexible Category Slabs",
        description:
            "Set custom base prices and bid increments for different player categories (Batsman, Bowler, All-Rounder).",
        color: "text-pink-400",
        glow: "group-hover:shadow-[0_0_30px_hsl(330,80%,60%,0.3)]",
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
        title: "Instant Reports",
        description: "Get sold/unsold lists and team squad summaries immediately after the auction.",
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
        // SEO: Set Page Title with target keywords
        document.title = "Vardhaman CricBid | Cricket Auction Software | Smart Automatic Bidding App";

        // SEO: Set Meta Description with keywords
        let metaDescription = document.querySelector('meta[name="description"]');
        if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
        }
        metaDescription.setAttribute('content', 'India\'s #1 cricket auction software with automatic smart bidding, WhatsApp notifications & live streaming. Best cheapest online auction app for IPL-style local tournaments, box cricket, gully cricket & corporate leagues.');

        // SEO: Set Keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
        }
        metaKeywords.setAttribute('content', 'cricket auction, auction software, smart auction software, automatic auction, automatic cricket auction, whatsapp cricket auction, cricket auction, cheapest cricket auction, online cricket auction, cricket auction app, IPL auction software, player bidding software, cricket tournament software');

    }, []);

    // Comprehensive Schema.org structured data for SEO
    const schemaData = [
        {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Vardhaman CricBid",
            "alternateName": ["CricBid", "Cricket Auction App", "Smart Auction Software"],
            "applicationCategory": "SportsApplication",
            "operatingSystem": "Web, Android, iOS",
            "url": "https://www.cricbid.online",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "INR",
                "availability": "https://schema.org/InStock"
            },
            "description": " cricket auction software with automatic smart bidding, WhatsApp integration, and real-time live streaming. Best platform for IPL-style local tournaments, box cricket, gully cricket, and corporate leagues.",
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "500",
                "bestRating": "5",
                "worstRating": "1"
            },
            "featureList": [
                "Cricket Auction Software",
                "Automatic Smart Bidding System",
                "WhatsApp Player Notifications",
                "Real-time Live Streaming",
                "Budget Tracking & Management",
                "Bulk Player Upload via CSV",
                "Multiple Category Support",
                "Team Squad Management"
            ]
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "Is Vardhaman CricBid to use?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes! Vardhaman CricBid is completely cricket auction software. You can host unlimited IPL-style auctions with automatic bidding, WhatsApp notifications, and live streaming at no cost."
                    }
                },
                {
                    "@type": "Question",
                    "name": "What is smart automatic auction software?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Smart automatic auction software like CricBid automatically calculates bid increments, tracks team budgets, enforces player limits, and sends WhatsApp notifications - eliminating manual work and human errors."
                    }
                },
                {
                    "@type": "Question",
                    "name": "Can I use this for box cricket or gully cricket auctions?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Absolutely! CricBid works for all types of cricket auctions - box cricket, gully cricket, corporate cricket, colony cricket, and professional local tournaments."
                    }
                }
            ]
        },
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Vardhaman CricBid",
            "url": "https://www.cricbid.online",
            "logo": "https://www.cricbid.online/src/assets/logo.png",
            "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "+91-8208216407",
                "contactType": "customer service",
                "areaServed": "IN",
                "availableLanguage": ["English", "Hindi"]
            },
            "sameAs": [
                "https://wa.me/918208216407"
            ]
        }
    ];

    return (
        <div className="overflow-hidden font-sans">
            {/* Schema.org Structured Data */}
            <script type="application/ld+json">
                {JSON.stringify(schemaData)}
            </script>

            {/* Landing Page Header */}
            <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-white rounded-lg shadow-glow overflow-hidden flex items-center justify-center">
                            <img src={logo} alt="Vardhaman cricBid Logo" className="h-10 w-[160px] object-contain scale-[2.1]" />
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
                        <span className="text-sm font-medium">India's Leading Cricket Auction Platform</span>
                    </motion.div>

                    {/* Main Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black mb-4 md:mb-6 leading-tight px-2"
                    >
                        <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                            Professional
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
                        Organize IPL-style player auctions for your local tournaments. Live bidding, squad management, and real-time updates—all in one app.
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

            {/* Demo Video Section */}
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

                    <motion.div {...scaleIn} className="max-w-5xl mx-auto">
                        <Card className="overflow-hidden bg-card/50 backdrop-blur border-primary/20 shadow-2xl">
                            <CardContent className="p-0">
                                <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group cursor-pointer">
                                    <div className="absolute inset-0 bg-[url('/stadium-bg.jpg')] bg-cover bg-center opacity-30" />
                                    <div className="relative z-10 text-center">
                                        <motion.div
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_50px_hsl(263,70%,50%,0.5)] group-hover:shadow-[0_0_70px_hsl(263,70%,50%,0.7)] transition-all duration-300"
                                        >
                                            <Play className="w-6 h-6 sm:w-10 sm:h-10 text-white ml-1" />
                                        </motion.div>
                                        <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground">Watch Demo Guide</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
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

            {/* Stats Section
            <section className="py-12 md:py-24 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />

                <div className="container mx-auto px-4 relative z-10">
                    <motion.div
                        {...staggerContainer}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8"
                    >
                        {stats.map((stat, index) => (
                            <motion.div
                                key={index}
                                {...staggerItem}
                                className="text-center"
                            >
                                <div className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1 sm:mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-muted-foreground text-sm sm:text-lg">{stat.label}</div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section> */}

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
                                    <h3 className="text-xl font-bold mb-2 text-foreground">What makes this a smart automatic auction software?</h3>
                                    <p className="text-muted-foreground">Our smart auction software automatically calculates bid increments based on slabs, tracks team budgets in real-time, enforces player limits, prevents overspending, and sends automatic WhatsApp notifications to players when they're sold or unsold - eliminating manual calculations and human errors.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Can I use this for box cricket, gully cricket, or corporate auctions?</h3>
                                    <p className="text-muted-foreground">Absolutely! Our cricket auction software works for all types - box cricket auctions, gully cricket auctions, corporate cricket leagues, colony cricket tournaments, and professional local tournaments. It's flexible enough to handle any cricket player auction format.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">How does WhatsApp cricket auction notification work?</h3>
                                    <p className="text-muted-foreground">Our WhatsApp integration automatically sends personalized messages to players the moment they are sold or remain unsold. Players receive instant notifications with their team name and sold amount - no manual messaging required. This is a unique feature of our cricket auction app.</p>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* <motion.div {...fadeInUp}>
                            <Card className="bg-card/50 backdrop-blur border-border/50">
                                <CardContent className="p-6">
                                    <h3 className="text-xl font-bold mb-2 text-foreground">Is this the best online auction software for cricket tournaments?</h3>
                                    <p className="text-muted-foreground">Vardhaman CricBid is rated 4.9★ by tournament organizers across India. With features like live bidding, automatic budget tracking, bulk player upload, real-time team purse updates, and WhatsApp integration - it's considered the best and cheapest cricket auction platform available online.</p>
                                </CardContent>
                            </Card>
                        </motion.div> */}
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
                            <img src={logo} alt="Vardhaman cricBid" className="w-8 h-8 rounded-md" />
                            <span className="text-xl font-bold">Vardhaman cricBid</span>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-muted-foreground">
                            <a href="#" className="hover:text-primary transition-colors">How it works</a>
                            <a href="#" className="hover:text-primary transition-colors">Features</a>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <a href="tel:8208216407" className="hover:text-primary transition-colors">8208216407</a>
                            </div>
                        </div>
                        <div className="text-muted-foreground text-sm">
                            © {new Date().getFullYear()} Vardhaman cricBid. All rights reserved.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
