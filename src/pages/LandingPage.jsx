// Reading this as: Web3 indie game landing page for builders & players, with a bright sky-blue / cloud-white clean gaming language, leaning toward custom grid layout, responsive bento, and playful motion.
/* DESIGN_VARIANCE: 7 | MOTION_INTENSITY: 6 | VISUAL_DENSITY: 4 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { REWARD_VAULT_ID, PACKAGE_ID } from "../chain/config";
import { WalletHeader } from "../components";
import { 
  Gamepad2, 
  Wrench, 
  Globe, 
  Coins, 
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Compass,
  Store,
  Blocks
} from "lucide-react";
import "./LandingPage.css";

export default function LandingPage() {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute, isPending: isClaiming } =
    useSignAndExecuteTransaction();
  const [faucetStatus, setFaucetStatus] = useState("");

  async function handleFaucet(amount = 50) {
    if (!account?.address) {
      setFaucetStatus("Connect wallet to claim faucet.");
      return;
    }
    if (!REWARD_VAULT_ID || !PACKAGE_ID) {
      setFaucetStatus("Missing REWARD_VAULT_ID or PACKAGE_ID.");
      return;
    }
    try {
      setFaucetStatus("Requesting faucet...");
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::reward_coin::faucet`,
        arguments: [tx.object(REWARD_VAULT_ID), tx.pure.u64(amount)],
      });
      await signAndExecute({ transaction: tx });
      setFaucetStatus(`Received ${amount} CHUNK.`);
    } catch (error) {
      console.error("Faucet failed", error);
      setFaucetStatus("Faucet failed. Check console.");
    }
  }

  return (
    <div className="landing">
      {/* Animated Space Sky Background */}
      <div className="landing__bg">
        <span className="landing__sky" />
        <span className="landing__sun" />
        <span className="landing__grid" />
        <span className="landing__nebula" />
        <span className="landing__mist" />
      </div>

      <div className="landing__content">
        {/* Navigation Bar (Single Line, <80px height) */}
        <header className="landing__nav">
          <div className="brand">
            <img 
              src="https://ik.imagekit.io/huubao/chunk_coin.png" 
              alt="Chunk World logo" 
              className="brand__img" 
            />
            <div className="brand__text">
              <span className="brand__name">Chunk World</span>
              <span className="brand__tag">Sky Adventures</span>
            </div>
          </div>

          <nav className="landing__links">
            <Link to="/game" className="nav-link">Play</Link>
            <Link to="/editor" className="nav-link">Editor</Link>
            <Link to="/marketplace" className="nav-link">Marketplace</Link>
          </nav>

          <div className="nav-actions">
            <WalletHeader />
          </div>
        </header>

        {/* Hero Section (Fits in viewport) */}
        <section className="landing__hero">
          <div className="hero__copy">
            <div className="hero__badge">
              <Sparkles className="badge__icon" size={12} strokeWidth={2} />
              <span>Powered by Sui Blockchain</span>
            </div>

            <h1 className="hero__title">
              Build your <span className="hero__accent">sky world</span>.
            </h1>

            <p className="hero__subtitle">
              Mine chunks, paint tiles, and explore floating worlds on Sui. Your creativity, on-chain.
            </p>

            <div className="hero__cta">
              <Link className="btn btn--solid" to="/game">
                <span>Launch Game</span>
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
              <Link className="btn btn--ghost" to="/editor">
                <span>Open Editor</span>
              </Link>
            </div>
          </div>

          {/* Hero Visual Showcase */}
          <div className="hero__showcase">
            <div className="showcase__wrapper">
              <img 
                src="/sky_island_bright.png" 
                alt="Sky island preview" 
                className="showcase__img" 
              />
              <div className="showcase__overlay">
                <div className="showcase__badge">
                  <ShieldCheck size={12} strokeWidth={2} />
                  <span>On-Chain Island Preview</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. Exploration & Adventure Section (Left Image, Right Copy) */}
        <section className="landing__section split-feature">
          <div className="feature__showcase">
            <div className="showcase__wrapper">
              <img 
                src="/game_explore.png" 
                alt="WASD Gameplay preview" 
                className="showcase__img" 
              />
            </div>
          </div>
          
          <div className="feature__copy">
            <div className="feature__icon-wrapper bg-emerald-100 text-emerald-600">
              <Gamepad2 size={24} strokeWidth={1.5} />
            </div>
            <h2 className="section-title">Explore Sky Islands</h2>
            <p className="section-desc">
              Control your hero in real-time with WASD movement. Traverse floating bridges, navigate portals, and explore maps made by other builders on-chain.
            </p>
            <ul className="feature__bullets">
              <li>
                <Compass size={16} strokeWidth={2} className="text-emerald-500" />
                <span>Real-time multiplayer lobbies</span>
              </li>
              <li>
                <Blocks size={16} strokeWidth={2} className="text-emerald-500" />
                <span>Discover hidden keys and portals</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 2. World Editor Section (Vertical Bento Layout, breaks zigzag) */}
        <section className="landing__section vertical-feature">
          <div className="features__header text-center">
            <span className="features__eyebrow">WORLD MAKER</span>
            <h2 className="features__title">The On-Chain Map Editor</h2>
            <p className="section-desc max-w-xl mx-auto mt-4 text-center">
              A powerful building tool in your browser. Carve chunks, detail terrain layers, and publish directly to the Sui blockchain.
            </p>
          </div>

          <div className="editor-showcase__grid">
            <div className="editor-showcase__image-box">
              <img 
                src="/game_editor.png" 
                alt="World Editor Showcase" 
                className="editor-showcase__img" 
              />
            </div>
            <div className="editor-showcase__details">
              <div className="detail-card">
                <Wrench className="text-orange-500" size={20} strokeWidth={2} />
                <h4>Stone Carving</h4>
                <p>Modify 5×5 tile blocks on-chain with detailed stone engravings and textures.</p>
              </div>
              <div className="detail-card">
                <Sparkles className="text-orange-500" size={20} strokeWidth={2} />
                <h4>Terrain Painting</h4>
                <p>Colorize chunks and paint grass, water paths, and custom environment tiles.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Marketplace & Economy Section (Right Image, Left Copy) */}
        <section className="landing__section split-feature split-feature--reverse">
          <div className="feature__copy">
            <div className="feature__icon-wrapper bg-amber-100 text-amber-600">
              <Coins size={24} strokeWidth={1.5} />
            </div>
            <h2 className="section-title">Sky Island Trading Post</h2>
            <p className="section-desc">
              Trade your custom-designed chunks as NFTs. Connect with other players in the game marketplace to purchase floating real estate and expand your territory.
            </p>
            <ul className="feature__bullets">
              <li>
                <Store size={16} strokeWidth={2} className="text-amber-500" />
                <span>Secure smart contract auction listings</span>
              </li>
              <li>
                <Globe size={16} strokeWidth={2} className="text-amber-500" />
                <span>$CHUNK utility token rewards integrated</span>
              </li>
            </ul>
          </div>

          <div className="feature__showcase">
            <div className="showcase__wrapper">
              <img 
                src="/game_market.png" 
                alt="Sky Trading Post Marketplace" 
                className="showcase__img" 
              />
            </div>
          </div>
        </section>

        {/* Faucet / Call to Action Section */}
        <section className="landing__cta">
          <div className="cta__content">
            <h2 className="cta__title">Claim Your First Chunk</h2>
            <p className="cta__subtitle">
              Connect your Sui wallet to request faucet tokens and begin carving your floating island.
            </p>
            <div className="cta__actions">
              <button
                className="btn btn--solid"
                onClick={() => handleFaucet(50)}
                disabled={isClaiming}
              >
                <span>{isClaiming ? "Claiming CHUNK..." : "Claim 50 CHUNK"}</span>
                <Coins size={14} strokeWidth={2} />
              </button>
              <Link className="btn btn--ghost" to="/game">
                <span>Enter Sky World</span>
              </Link>
            </div>
            {faucetStatus && (
              <div className="cta__status">
                <span className="status__dot" />
                <p className="status__text">{faucetStatus}</p>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="landing__footer">
          <div className="footer__info">
            <span>Chunk World © 2026. Made with love on Sui.</span>
          </div>
          <div className="footer__links">
            <Link to="/game">Play</Link>
            <Link to="/editor">Editor</Link>
            <Link to="/marketplace">Marketplace</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
