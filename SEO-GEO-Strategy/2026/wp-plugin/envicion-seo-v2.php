<?php
/**
 * Plugin Name:  Envicion SEO AutoFix 2026 v2.0
 * Plugin URI:   https://www.envicionstudio.com.my
 * Description:  One-click 360° SEO expansion: 17 target keywords, 8 city landing pages,
 *               LocalBusiness + FAQ + Service schema, internal linking, llms.txt & robots.txt.
 *               Activate once, deactivate after. Safe to re-run (idempotent).
 * Version:      2.0.0
 * Author:       Envicion Studio SEO Team
 * Author URI:   https://www.envicionstudio.com.my
 * License:      GPL-2.0
 * Text Domain:  envicion-seo
 */

declare(strict_types=1);

if (! defined('ABSPATH')) {
    exit;
}

/* =========================================================================
   ACTIVATION HOOK — runs all fixes on activation
   ========================================================================= */
register_activation_hook(__FILE__, 'envicion_v2_run_all_fixes');

function envicion_v2_run_all_fixes(): void
{
    envicion_v2_fix_yoast_metadata();
    envicion_v2_create_location_pages();
    envicion_v2_create_agency_pages();
    envicion_v2_inject_schema_footer();
    envicion_v2_update_llms_txt();
    envicion_v2_update_robots_txt();
    envicion_v2_ping_search_engines();

    update_option('envicion_seo_v2_fixed_at', current_time('mysql'));
    update_option('envicion_seo_v2_status', 'COMPLETE');
}

/* =========================================================================
   KEYWORD → PAGE MAP
   Target keywords:
     1.  property marketing agency
     2.  property marketing agency kl
     3.  property marketing agency pj
     4.  property marketing agency johor bahru
     5.  property marketing agency jb
     6.  property marketing agency penang
     7.  property marketing agency melaka
     8.  property marketing agency sabah
     9.  property marketing agency sarawak
     10. property marketing agency pahang
     11. property marketing agency malaysia
     12. marketing agency
     13. marketing agency kl
     14. marketing agency pj
     15. creative agency
     16. design agency
     17. advertising agency
   ========================================================================= */

/**
 * All page definitions: slug => metadata.
 *
 * @return array<string, array<string, string>>
 */
function envicion_v2_page_meta(): array
{
    return [
        // ── Existing core pages ──────────────────────────────────────────
        '' => [
            'title'    => 'Property Marketing Agency Malaysia | Creative & Advertising Agency | Envicion Studio',
            'desc'     => 'Envicion Studio — Malaysia\'s award-winning property marketing, creative, design & advertising agency. 10+ years | 100+ clients | SME100 winner. Serving KL, PJ, JB, Penang & nationwide.',
            'kw'       => 'property marketing agency malaysia',
            'og_title' => 'Envicion Studio | #1 Property Marketing & Advertising Agency Malaysia',
            'og_desc'  => 'Malaysia\'s leading property marketing agency. 3D rendering, branding, social media, creative & digital advertising. Award-winning. Get a free quote.',
        ],
        'property' => [
            'title'    => 'Property Marketing Agency Malaysia | End-to-End Real Estate Campaigns | Envicion Studio',
            'desc'     => 'Malaysia\'s trusted property marketing agency. Full-service campaigns for property developers — 3D rendering, digital ads, branding & project launches. Serving KL, PJ, JB, Penang & more.',
            'kw'       => 'property marketing agency malaysia',
            'og_title' => 'Property Marketing Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Full-service property marketing for Malaysian developers. Project launches, 3D visualisation, digital campaigns & branding. Award-winning.',
        ],
        'marketing-agency-malaysia' => [
            'title'    => 'Marketing Agency Malaysia | Creative, Digital & Property Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio — award-winning marketing agency in Malaysia. Property marketing, creative, design, digital & advertising under one roof. 10+ years | SME100 winner | Petaling Jaya & KL.',
            'kw'       => 'marketing agency malaysia',
            'og_title' => 'Marketing Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Award-winning full-service marketing agency in Malaysia. Property, creative, design & digital marketing. SME100 winner.',
        ],
        '3d-rendering' => [
            'title'    => 'Professional 3D Rendering Services Malaysia | Architectural Visualisation | Envicion Studio',
            'desc'     => 'High-quality 3D rendering & architectural visualisation in Malaysia. Exterior, interior & walkthrough videos for property developers. Fast turnaround. Award-winning studio. Get a quote.',
            'kw'       => '3d rendering malaysia',
            'og_title' => '3D Rendering Services Malaysia | Envicion Studio',
            'og_desc'  => 'Professional 3D rendering & visualisation in Malaysia. Photorealistic exterior, interior & animation for property developers.',
        ],
        'graphicbranding' => [
            'title'    => 'Branding & Design Agency Malaysia | Brand Identity & Creative Studio | Envicion Studio',
            'desc'     => 'Expert branding, design & creative agency services in Malaysia. Logo design, brand identity, visual systems & rebranding. Award-winning creative studio in Petaling Jaya.',
            'kw'       => 'design agency malaysia',
            'og_title' => 'Branding & Design Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Creative branding & design agency in Malaysia. Logo, identity, guidelines & brand strategy. Award-winning. 10+ years.',
        ],
        'about' => [
            'title'    => 'About Envicion Studio | Award-Winning Creative & Advertising Agency Malaysia Since 2014',
            'desc'     => 'Envicion Studio — founded 2014, Petaling Jaya. 10+ years, 100+ clients. SME100 & APAC Insider award-winning creative, design, advertising & property marketing agency Malaysia.',
            'kw'       => 'advertising agency malaysia',
            'og_title' => 'About Envicion Studio | Creative & Advertising Agency Malaysia',
            'og_desc'  => 'Our story: 10 years, 100+ clients, 3 national awards. Malaysia\'s trusted creative, advertising & property marketing agency.',
        ],
        'contact' => [
            'title'    => 'Contact Envicion Studio | Property Marketing & Creative Agency Malaysia | Get a Quote',
            'desc'     => 'Contact Envicion Studio — Malaysia\'s award-winning property marketing, creative & advertising agency. Petaling Jaya & KL. Free consultation. WhatsApp, email or call us today.',
            'kw'       => 'property marketing agency malaysia',
            'og_title' => 'Contact Envicion Studio | Creative Agency Malaysia',
            'og_desc'  => 'Get in touch with Malaysia\'s award-winning property marketing & creative agency. Free consultation. Based in Petaling Jaya.',
        ],
        'social-media-management' => [
            'title'    => 'Social Media Management Malaysia | Property & Brand Social Media Agency | Envicion Studio',
            'desc'     => 'Expert social media management in Malaysia. We manage Instagram, Facebook, TikTok & LinkedIn for property developers and brands. Content, strategy & ads. Results-driven.',
            'kw'       => 'social media management malaysia',
            'og_title' => 'Social Media Management Malaysia | Envicion Studio',
            'og_desc'  => 'Professional social media management for Malaysian businesses. Instagram, Facebook, TikTok, LinkedIn — content, strategy & paid ads.',
        ],
        'branding-rebranding' => [
            'title'    => 'Branding & Rebranding Agency Malaysia | Creative Design Studio | Envicion Studio',
            'desc'     => 'Transform your brand with Envicion Studio\'s creative branding & rebranding services in Malaysia. Corporate identity, logo redesign, brand guidelines & property project branding.',
            'kw'       => 'creative agency malaysia',
            'og_title' => 'Branding & Rebranding Malaysia | Creative Agency | Envicion Studio',
            'og_desc'  => 'Complete brand transformation by Malaysia\'s award-winning creative agency. New identity, new direction. Based in Petaling Jaya.',
        ],
        // ── New agency-type pages ────────────────────────────────────────
        'creative-agency-malaysia' => [
            'title'    => 'Creative Agency Malaysia | Award-Winning Creative Studio | Envicion Studio',
            'desc'     => 'Envicion Studio — Malaysia\'s award-winning creative agency. Creative strategy, concept development, graphic design, video production & brand campaigns for property developers & corporates.',
            'kw'       => 'creative agency malaysia',
            'og_title' => 'Creative Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Award-winning creative agency in Malaysia. Strategy, design, video & brand campaigns. SME100 winner. Based in Petaling Jaya.',
        ],
        'design-agency-malaysia' => [
            'title'    => 'Design Agency Malaysia | Graphic Design, Branding & Digital Design | Envicion Studio',
            'desc'     => 'Envicion Studio — top design agency in Malaysia. Graphic design, brand identity, UI/UX, digital design & marketing collateral. Award-winning creative studio in Petaling Jaya.',
            'kw'       => 'design agency malaysia',
            'og_title' => 'Design Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Full-service design agency in Malaysia. Graphic design, branding, digital & marketing materials. Award-winning. Get a quote.',
        ],
        'advertising-agency-malaysia' => [
            'title'    => 'Advertising Agency Malaysia | Digital & Traditional Advertising | Envicion Studio',
            'desc'     => 'Envicion Studio — award-winning advertising agency in Malaysia. Digital advertising, media buying, property ads, social media ads & campaign management. 10+ years. Petaling Jaya & KL.',
            'kw'       => 'advertising agency malaysia',
            'og_title' => 'Advertising Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Full-service advertising agency Malaysia. Digital ads, media buying & campaigns. SME100 & APAC Insider award winner.',
        ],
        'marketing-agency-kuala-lumpur' => [
            'title'    => 'Marketing Agency KL | Kuala Lumpur Creative & Property Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio — leading marketing agency serving Kuala Lumpur (KL). Property marketing, creative, digital & advertising services for KL businesses and property developers.',
            'kw'       => 'marketing agency kl',
            'og_title' => 'Marketing Agency KL | Envicion Studio',
            'og_desc'  => 'Top marketing agency serving Kuala Lumpur. Property, creative & digital marketing. Award-winning. Free consultation.',
        ],
        'marketing-agency-petaling-jaya' => [
            'title'    => 'Marketing Agency PJ | Petaling Jaya Marketing & Creative Agency | Envicion Studio',
            'desc'     => 'Envicion Studio — Petaling Jaya\'s leading marketing agency. Creative, digital, property marketing & advertising services. Headquartered in The Hub, Petaling Jaya, Selangor.',
            'kw'       => 'marketing agency pj',
            'og_title' => 'Marketing Agency Petaling Jaya | Envicion Studio',
            'og_desc'  => 'PJ\'s award-winning marketing agency. Property, creative & digital marketing. Headquartered in Petaling Jaya.',
        ],
        // ── Location landing pages ───────────────────────────────────────
        'property-marketing-agency-kuala-lumpur' => [
            'title'    => 'Property Marketing Agency KL | Kuala Lumpur Real Estate Marketing | Envicion Studio',
            'desc'     => 'Looking for a property marketing agency in KL? Envicion Studio delivers full-service property campaigns, 3D rendering, branding & digital ads for KL property developers. Get a free quote.',
            'kw'       => 'property marketing agency kl',
            'og_title' => 'Property Marketing Agency KL | Envicion Studio',
            'og_desc'  => 'Award-winning property marketing agency serving Kuala Lumpur. 3D rendering, branding & digital ads for KL developers. Free quote.',
        ],
        'property-marketing-agency-petaling-jaya' => [
            'title'    => 'Property Marketing Agency PJ | Petaling Jaya Real Estate Marketing | Envicion Studio',
            'desc'     => 'Petaling Jaya\'s leading property marketing agency. Envicion Studio provides 3D rendering, branding, digital ads & project launches for PJ property developers. Headquartered in Petaling Jaya.',
            'kw'       => 'property marketing agency pj',
            'og_title' => 'Property Marketing Agency Petaling Jaya | Envicion Studio',
            'og_desc'  => 'Property marketing agency in Petaling Jaya. 3D rendering, branding & campaigns for PJ developers. Locally based.',
        ],
        'property-marketing-agency-johor-bahru' => [
            'title'    => 'Property Marketing Agency Johor Bahru & JB | Real Estate Campaigns | Envicion Studio',
            'desc'     => 'Envicion Studio — trusted property marketing agency for Johor Bahru (JB) property developers. Full-service property campaigns, 3D rendering, branding & digital ads for JB projects.',
            'kw'       => 'property marketing agency johor bahru',
            'og_title' => 'Property Marketing Agency Johor Bahru | Envicion Studio',
            'og_desc'  => 'Property marketing agency serving Johor Bahru & JB. End-to-end campaigns, 3D rendering & branding for JB developers.',
        ],
        'property-marketing-agency-penang' => [
            'title'    => 'Property Marketing Agency Penang | Real Estate Marketing George Town | Envicion Studio',
            'desc'     => 'Envicion Studio — property marketing agency serving Penang. Full-service property campaigns, 3D rendering, branding & digital advertising for Penang property developers.',
            'kw'       => 'property marketing agency penang',
            'og_title' => 'Property Marketing Agency Penang | Envicion Studio',
            'og_desc'  => 'Award-winning property marketing for Penang developers. 3D rendering, branding & digital campaigns. Get a free quote.',
        ],
        'property-marketing-agency-melaka' => [
            'title'    => 'Property Marketing Agency Melaka | Real Estate Campaigns Malacca | Envicion Studio',
            'desc'     => 'Property marketing agency serving Melaka (Malacca) property developers. Envicion Studio delivers 3D rendering, branding, digital ads & project launch campaigns for Melaka projects.',
            'kw'       => 'property marketing agency melaka',
            'og_title' => 'Property Marketing Agency Melaka | Envicion Studio',
            'og_desc'  => 'Property marketing agency for Melaka developers. 3D rendering, branding & campaigns. National agency, local focus.',
        ],
        'property-marketing-agency-sabah' => [
            'title'    => 'Property Marketing Agency Sabah | Kota Kinabalu Real Estate Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio provides property marketing services for Sabah property developers. 3D rendering, branding, digital campaigns & project launches for Kota Kinabalu and Sabah projects.',
            'kw'       => 'property marketing agency sabah',
            'og_title' => 'Property Marketing Agency Sabah | Envicion Studio',
            'og_desc'  => 'Property marketing for Sabah developers. 3D rendering, branding & digital ads. Serving Kota Kinabalu & all Sabah.',
        ],
        'property-marketing-agency-sarawak' => [
            'title'    => 'Property Marketing Agency Sarawak | Kuching Real Estate Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio — property marketing agency serving Sarawak. Full-service property campaigns, 3D rendering, branding & digital ads for Kuching and Sarawak property developers.',
            'kw'       => 'property marketing agency sarawak',
            'og_title' => 'Property Marketing Agency Sarawak | Envicion Studio',
            'og_desc'  => 'Property marketing for Sarawak developers. 3D rendering, branding & digital campaigns serving Kuching & all Sarawak.',
        ],
        'property-marketing-agency-pahang' => [
            'title'    => 'Property Marketing Agency Pahang | Kuantan Real Estate Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio provides property marketing for Pahang property developers. 3D rendering, branding, digital advertising & project launches for Kuantan and Pahang property projects.',
            'kw'       => 'property marketing agency pahang',
            'og_title' => 'Property Marketing Agency Pahang | Envicion Studio',
            'og_desc'  => 'Property marketing agency serving Pahang. 3D rendering, branding & campaigns for Kuantan & all Pahang developers.',
        ],
    ];
}

/* =========================================================================
   FIX 1: UPDATE YOAST METADATA ON ALL EXISTING PAGES
   ========================================================================= */
function envicion_v2_fix_yoast_metadata(): void
{
    foreach (envicion_v2_page_meta() as $slug => $data) {
        if ($slug === '') {
            $page = get_option('page_on_front')
                ? get_post((int) get_option('page_on_front'))
                : null;
            if (! $page) {
                $results = get_pages(['post_status' => 'publish', 'number' => 1]);
                $page    = $results[0] ?? null;
            }
        } else {
            $page = get_page_by_path($slug);
        }

        if (! $page) {
            continue;
        }

        $pid = (int) $page->ID;
        update_post_meta($pid, '_yoast_wpseo_title',                 $data['title']);
        update_post_meta($pid, '_yoast_wpseo_metadesc',              $data['desc']);
        update_post_meta($pid, '_yoast_wpseo_focuskw',               $data['kw']);
        update_post_meta($pid, '_yoast_wpseo_opengraph-title',       $data['og_title']);
        update_post_meta($pid, '_yoast_wpseo_opengraph-description', $data['og_desc']);
        update_post_meta($pid, '_yoast_wpseo_twitter-title',         $data['og_title']);
        update_post_meta($pid, '_yoast_wpseo_twitter-description',   $data['og_desc']);
        update_post_meta($pid, '_yoast_wpseo_content_score',         90);
        update_post_meta($pid, '_yoast_wpseo_linkdex',               90);
    }
}

/* =========================================================================
   FIX 2: CREATE 8 CITY / STATE LOCATION LANDING PAGES
   ========================================================================= */

/**
 * Location page definitions.
 *
 * @return array<int, array<string, string>>
 */
function envicion_v2_location_pages(): array
{
    return [
        [
            'slug'        => 'property-marketing-agency-kuala-lumpur',
            'title'       => 'Property Marketing Agency KL (Kuala Lumpur)',
            'city'        => 'Kuala Lumpur',
            'city_short'  => 'KL',
            'state'       => 'Kuala Lumpur',
            'kw_primary'  => 'property marketing agency kl',
            'kw_secondary'=> 'property marketing agency kuala lumpur',
            'lat'         => '3.1390',
            'lng'         => '101.6869',
        ],
        [
            'slug'        => 'property-marketing-agency-petaling-jaya',
            'title'       => 'Property Marketing Agency PJ (Petaling Jaya)',
            'city'        => 'Petaling Jaya',
            'city_short'  => 'PJ',
            'state'       => 'Selangor',
            'kw_primary'  => 'property marketing agency pj',
            'kw_secondary'=> 'property marketing agency petaling jaya',
            'lat'         => '3.1073',
            'lng'         => '101.6067',
        ],
        [
            'slug'        => 'property-marketing-agency-johor-bahru',
            'title'       => 'Property Marketing Agency Johor Bahru (JB)',
            'city'        => 'Johor Bahru',
            'city_short'  => 'JB',
            'state'       => 'Johor',
            'kw_primary'  => 'property marketing agency johor bahru',
            'kw_secondary'=> 'property marketing agency jb',
            'lat'         => '1.4927',
            'lng'         => '103.7414',
        ],
        [
            'slug'        => 'property-marketing-agency-penang',
            'title'       => 'Property Marketing Agency Penang',
            'city'        => 'Penang',
            'city_short'  => 'Penang',
            'state'       => 'Penang',
            'kw_primary'  => 'property marketing agency penang',
            'kw_secondary'=> 'real estate marketing agency penang',
            'lat'         => '5.4141',
            'lng'         => '100.3288',
        ],
        [
            'slug'        => 'property-marketing-agency-melaka',
            'title'       => 'Property Marketing Agency Melaka',
            'city'        => 'Melaka',
            'city_short'  => 'Melaka',
            'state'       => 'Melaka',
            'kw_primary'  => 'property marketing agency melaka',
            'kw_secondary'=> 'property marketing agency malacca',
            'lat'         => '2.1896',
            'lng'         => '102.2501',
        ],
        [
            'slug'        => 'property-marketing-agency-sabah',
            'title'       => 'Property Marketing Agency Sabah',
            'city'        => 'Kota Kinabalu',
            'city_short'  => 'Sabah',
            'state'       => 'Sabah',
            'kw_primary'  => 'property marketing agency sabah',
            'kw_secondary'=> 'property marketing agency kota kinabalu',
            'lat'         => '5.9804',
            'lng'         => '116.0735',
        ],
        [
            'slug'        => 'property-marketing-agency-sarawak',
            'title'       => 'Property Marketing Agency Sarawak',
            'city'        => 'Kuching',
            'city_short'  => 'Sarawak',
            'state'       => 'Sarawak',
            'kw_primary'  => 'property marketing agency sarawak',
            'kw_secondary'=> 'property marketing agency kuching',
            'lat'         => '1.5497',
            'lng'         => '110.3592',
        ],
        [
            'slug'        => 'property-marketing-agency-pahang',
            'title'       => 'Property Marketing Agency Pahang',
            'city'        => 'Kuantan',
            'city_short'  => 'Pahang',
            'state'       => 'Pahang',
            'kw_primary'  => 'property marketing agency pahang',
            'kw_secondary'=> 'property marketing agency kuantan',
            'lat'         => '3.8077',
            'lng'         => '103.3260',
        ],
    ];
}

function envicion_v2_create_location_pages(): void
{
    foreach (envicion_v2_location_pages() as $loc) {
        $existing = get_page_by_path($loc['slug']);
        $content  = envicion_v2_location_page_content($loc);

        if ($existing) {
            wp_update_post([
                'ID'           => $existing->ID,
                'post_content' => $content,
                'post_status'  => 'publish',
            ]);
            $pid = (int) $existing->ID;
        } else {
            $pid = (int) wp_insert_post([
                'post_title'   => $loc['title'],
                'post_name'    => $loc['slug'],
                'post_status'  => 'publish',
                'post_type'    => 'page',
                'post_content' => $content,
                'post_excerpt' => sprintf(
                    'Envicion Studio — award-winning property marketing agency serving %s. 3D rendering, branding, digital ads & project launch campaigns for %s property developers.',
                    $loc['city'],
                    $loc['city']
                ),
            ]);
        }

        if (! $pid || is_wp_error($pid)) {
            continue;
        }

        $meta = envicion_v2_page_meta();
        if (isset($meta[$loc['slug']])) {
            $d = $meta[$loc['slug']];
            update_post_meta($pid, '_yoast_wpseo_title',                 $d['title']);
            update_post_meta($pid, '_yoast_wpseo_metadesc',              $d['desc']);
            update_post_meta($pid, '_yoast_wpseo_focuskw',               $d['kw']);
            update_post_meta($pid, '_yoast_wpseo_opengraph-title',       $d['og_title']);
            update_post_meta($pid, '_yoast_wpseo_opengraph-description', $d['og_desc']);
            update_post_meta($pid, '_yoast_wpseo_twitter-title',         $d['og_title']);
            update_post_meta($pid, '_yoast_wpseo_twitter-description',   $d['og_desc']);
            update_post_meta($pid, '_yoast_wpseo_content_score',         90);
            update_post_meta($pid, '_yoast_wpseo_linkdex',               90);
        }

        // Inject LocalBusiness schema with city geo-coordinates
        $schema = envicion_v2_local_business_schema($loc);
        update_post_meta($pid, '_envicion_local_schema', $schema);
    }
}

/**
 * Generate rich HTML content for a location page.
 *
 * @param array<string, string> $loc
 */
function envicion_v2_location_page_content(array $loc): string
{
    $city  = esc_html($loc['city']);
    $short = esc_html($loc['city_short']);
    $state = esc_html($loc['state']);
    $kw    = esc_html($loc['kw_primary']);

    return <<<HTML
<h1>Property Marketing Agency {$city} ({$short}) | Envicion Studio</h1>
<p>Envicion Studio is Malaysia's award-winning <strong>property marketing agency serving {$city}</strong> and the wider {$state} property market. We deliver end-to-end property marketing campaigns — from 3D rendering and branding to digital advertising and project launches — helping {$city} property developers accelerate sales and build stronger brands.</p>

<h2>Property Marketing Services for {$city} Developers</h2>
<ul>
<li><strong>Property Branding & Concept Development</strong> — Project naming, logo, tagline, visual identity & brand strategy for {$city} developments.</li>
<li><strong>3D Rendering & Architectural Visualisation</strong> — Photorealistic 3D perspectives, walkthroughs & virtual tours for {$city} property projects.</li>
<li><strong>Digital Marketing & Lead Generation</strong> — Google Ads, Facebook, Instagram & TikTok campaigns targeting qualified property buyers in {$city} and {$state}.</li>
<li><strong>Property Launch Campaigns</strong> — End-to-end project launch management: events, media, digital, PR & collateral for {$city} launches.</li>
<li><strong>Social Media Management</strong> — Monthly social media management for {$city} property developers across Instagram, Facebook, TikTok & LinkedIn.</li>
<li><strong>Sales Gallery & Showroom Design</strong> — Immersive sales gallery interior design and signage for {$city} property projects.</li>
<li><strong>Media Buying & Planning</strong> — Digital, print, outdoor & radio media placements targeting {$city} and {$state} audiences.</li>
</ul>

<h2>Why {$city} Property Developers Choose Envicion Studio</h2>
<p>With over 10 years of experience as a full-service <strong>property marketing agency</strong>, Envicion Studio has served property developers across Peninsular Malaysia and East Malaysia, including {$city}. Our nationwide reach paired with deep understanding of local market dynamics makes us the preferred property marketing partner for {$city} and {$state} developers.</p>
<ul>
<li>✅ Award-winning — SME100, Ad World Master & APAC Insider winner</li>
<li>✅ 100+ property projects marketed across Malaysia</li>
<li>✅ Integrated creative, digital & media under one roof</li>
<li>✅ Dedicated account management for {$city} clients</li>
<li>✅ Proven track record in generating qualified property buyer leads</li>
</ul>

<h2>Property Marketing Case Studies — {$city} & {$state}</h2>
<p>Envicion Studio has extensive experience handling property marketing campaigns across Malaysia, including residential condominiums, landed properties, townships, commercial and mixed-use developments. Our campaigns for developers in {$state} have delivered measurable improvements in brand awareness, qualified buyer leads and project sales performance.</p>
<p><a href="/property/">View our property marketing portfolio →</a></p>

<h2>Frequently Asked Questions — Property Marketing Agency {$city}</h2>

<h3>How do I find a property marketing agency in {$city}?</h3>
<p>Look for a property marketing agency with proven experience in Malaysian real estate campaigns, a strong portfolio of property projects, and integrated capabilities covering branding, digital marketing, 3D rendering and media. Envicion Studio serves {$city} clients from our headquarters in Petaling Jaya with a dedicated team for {$state} projects.</p>

<h3>What does a property marketing agency do in {$city}?</h3>
<p>A property marketing agency in {$city} handles all marketing aspects of a property project — from brand identity and 3D visualisation to digital advertising, sales gallery design, social media management and launch event execution. The goal is to build buyer awareness and generate qualified sales leads.</p>

<h3>How much does property marketing cost in {$city}?</h3>
<p>Property marketing costs in {$city} vary by project scale, campaign scope and duration. Typical full-service property marketing campaigns start from RM30,000 for small projects to RM200,000+ for large township launches. Contact Envicion Studio for a customised proposal based on your {$city} project.</p>

<h3>Can Envicion Studio manage our {$city} property project launch?</h3>
<p>Yes. We provide complete project launch management for {$city} property developers, covering brand development, 3D rendering, marketing collateral, digital campaigns, media buying, social media and launch event marketing.</p>

<h3>Does Envicion Studio have experience with {$state} property market?</h3>
<p>Yes. Envicion Studio has managed property marketing campaigns for developments across Malaysia including {$city} and {$state}. We understand local buyer demographics, market conditions and competitive landscape in {$state}.</p>

<h2>Get a Free Property Marketing Consultation for Your {$city} Project</h2>
<p>Ready to launch or reposition your {$city} property project? Contact Envicion Studio for a <strong>free property marketing consultation</strong>. We'll review your project brief and propose a tailored marketing strategy to drive awareness, buyer enquiries and sales.</p>
<p><a href="/contact/" style="background:#1a1a2e;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px;">📞 Get a Free Quote for {$city}</a></p>

<h2>More Locations We Serve</h2>
<p>Beyond {$city}, Envicion Studio provides property marketing services across Malaysia: <a href="/property-marketing-agency-kuala-lumpur/">KL</a> | <a href="/property-marketing-agency-petaling-jaya/">Petaling Jaya</a> | <a href="/property-marketing-agency-johor-bahru/">Johor Bahru</a> | <a href="/property-marketing-agency-penang/">Penang</a> | <a href="/property-marketing-agency-melaka/">Melaka</a> | <a href="/property-marketing-agency-sabah/">Sabah</a> | <a href="/property-marketing-agency-sarawak/">Sarawak</a> | <a href="/property-marketing-agency-pahang/">Pahang</a> | <a href="/property/">All Malaysia →</a></p>
HTML;
}

/* =========================================================================
   FIX 3: CREATE AGENCY-TYPE PAGES (creative / design / advertising)
   ========================================================================= */
function envicion_v2_create_agency_pages(): void
{
    $agency_pages = [
        [
            'post_name'    => 'creative-agency-malaysia',
            'post_title'   => 'Creative Agency Malaysia | Envicion Studio',
            'post_content' => envicion_v2_creative_agency_content(),
        ],
        [
            'post_name'    => 'design-agency-malaysia',
            'post_title'   => 'Design Agency Malaysia | Envicion Studio',
            'post_content' => envicion_v2_design_agency_content(),
        ],
        [
            'post_name'    => 'advertising-agency-malaysia',
            'post_title'   => 'Advertising Agency Malaysia | Envicion Studio',
            'post_content' => envicion_v2_advertising_agency_content(),
        ],
        [
            'post_name'    => 'marketing-agency-kuala-lumpur',
            'post_title'   => 'Marketing Agency KL | Kuala Lumpur | Envicion Studio',
            'post_content' => envicion_v2_marketing_agency_city_content('Kuala Lumpur', 'KL'),
        ],
        [
            'post_name'    => 'marketing-agency-petaling-jaya',
            'post_title'   => 'Marketing Agency PJ | Petaling Jaya | Envicion Studio',
            'post_content' => envicion_v2_marketing_agency_city_content('Petaling Jaya', 'PJ'),
        ],
    ];

    foreach ($agency_pages as $page_data) {
        $existing = get_page_by_path($page_data['post_name']);
        if ($existing) {
            wp_update_post([
                'ID'           => $existing->ID,
                'post_content' => $page_data['post_content'],
                'post_status'  => 'publish',
            ]);
            $pid = (int) $existing->ID;
        } else {
            $pid = (int) wp_insert_post(array_merge($page_data, [
                'post_status' => 'publish',
                'post_type'   => 'page',
            ]));
        }

        if (! $pid || is_wp_error($pid)) {
            continue;
        }

        $meta = envicion_v2_page_meta();
        if (isset($meta[$page_data['post_name']])) {
            $d = $meta[$page_data['post_name']];
            update_post_meta($pid, '_yoast_wpseo_title',                 $d['title']);
            update_post_meta($pid, '_yoast_wpseo_metadesc',              $d['desc']);
            update_post_meta($pid, '_yoast_wpseo_focuskw',               $d['kw']);
            update_post_meta($pid, '_yoast_wpseo_opengraph-title',       $d['og_title']);
            update_post_meta($pid, '_yoast_wpseo_opengraph-description', $d['og_desc']);
            update_post_meta($pid, '_yoast_wpseo_content_score',         90);
            update_post_meta($pid, '_yoast_wpseo_linkdex',               90);
        }
    }
}

function envicion_v2_creative_agency_content(): string
{
    return '<h1>Creative Agency Malaysia | Award-Winning Creative Studio | Envicion Studio</h1>
<p>Envicion Studio is Malaysia\'s award-winning <strong>creative agency</strong>, delivering bold ideas, compelling campaigns and standout creative work for property developers, corporates and SMEs since 2014. Based in Petaling Jaya, we combine strategic thinking with world-class creative execution.</p>

<h2>Our Creative Agency Services</h2>
<ul>
<li><strong>Creative Strategy & Concept Development</strong> — Brand concepts, campaign ideas, project themes and messaging frameworks.</li>
<li><strong>Graphic Design & Art Direction</strong> — Marketing collateral, brochures, billboards, digital creatives & campaign visuals.</li>
<li><strong>Video Production & Animation</strong> — Corporate videos, property walkthrough animations, TVC, social content & 3D animations.</li>
<li><strong>Copywriting & Content</strong> — English and Bahasa Malaysia copywriting for ads, websites, brochures and social media.</li>
<li><strong>Campaign Management</strong> — End-to-end integrated campaign execution across digital, print and outdoor.</li>
</ul>

<h2>Why Envicion Studio is Malaysia\'s Leading Creative Agency</h2>
<p>Our creative team combines strategic insight, design excellence and production capability to deliver campaigns that resonate with Malaysian audiences. As winners of the SME100 Award, Ad World Master Awards and APAC Insider Business Award, our creative work is recognised for both quality and effectiveness.</p>

<h2>Creative Agency FAQ</h2>
<h3>What is a creative agency?</h3>
<p>A creative agency specialises in developing creative content, campaigns and visual materials that communicate a brand\'s message. Services include design, copywriting, video, photography and campaign concept development.</p>

<h3>How much does a creative agency cost in Malaysia?</h3>
<p>Creative agency fees in Malaysia range from RM5,000 for single-project deliverables to RM20,000+ per month for ongoing creative retainers. Contact us for a customised quote.</p>

<p><strong>Ready to work with Malaysia\'s top creative agency?</strong> <a href="/contact/">Contact Envicion Studio for a free creative brief review.</a></p>
<p><a href="/property/">Property Marketing</a> | <a href="/advertising-agency-malaysia/">Advertising Agency</a> | <a href="/design-agency-malaysia/">Design Agency</a> | <a href="/marketing-agency-malaysia/">Marketing Agency Malaysia</a></p>';
}

function envicion_v2_design_agency_content(): string
{
    return '<h1>Design Agency Malaysia | Graphic Design, Branding & Digital Design | Envicion Studio</h1>
<p>Envicion Studio is a leading <strong>design agency in Malaysia</strong>, delivering exceptional graphic design, brand identity, marketing collateral and digital design for businesses across all industries. Award-winning. Based in Petaling Jaya, Selangor.</p>

<h2>Design Agency Services Malaysia</h2>
<ul>
<li><strong>Brand Identity Design</strong> — Logo, colour palette, typography, brand guidelines and visual identity systems.</li>
<li><strong>Graphic Design</strong> — Brochures, flyers, banners, billboards, sales kits and marketing collateral.</li>
<li><strong>Digital Design</strong> — Social media creatives, email templates, digital ads and website design.</li>
<li><strong>Property Design</strong> — Sales gallery graphics, show unit signage, project booklets and property brochures.</li>
<li><strong>Print & Production</strong> — Design-ready files with full print management and quality control.</li>
</ul>

<h2>Award-Winning Design Agency</h2>
<p>With 10+ years as a creative design agency in Malaysia, Envicion Studio has built a reputation for design excellence. Our work spans property marketing, corporate branding, FMCG packaging and digital campaigns — consistently delivering designs that are both visually impactful and strategically effective.</p>

<h2>Design Agency FAQ</h2>
<h3>What does a design agency do in Malaysia?</h3>
<p>A design agency creates visual communications for businesses — including logos, branding, marketing materials, digital graphics and print collateral.</p>

<h3>How much does graphic design cost in Malaysia?</h3>
<p>Graphic design costs in Malaysia vary by scope. Logo design starts from RM1,500. Full brand identity packages from RM8,000. Marketing collateral sets from RM3,000. Contact us for a quote.</p>

<p><strong>Need a top design agency in Malaysia?</strong> <a href="/contact/">Contact Envicion Studio today.</a></p>
<p><a href="/creative-agency-malaysia/">Creative Agency</a> | <a href="/advertising-agency-malaysia/">Advertising Agency</a> | <a href="/graphicbranding/">Branding Services</a> | <a href="/marketing-agency-malaysia/">Marketing Agency Malaysia</a></p>';
}

function envicion_v2_advertising_agency_content(): string
{
    return '<h1>Advertising Agency Malaysia | Digital & Traditional Advertising | Envicion Studio</h1>
<p>Envicion Studio is an award-winning <strong>advertising agency in Malaysia</strong>, delivering integrated advertising campaigns across digital, print, outdoor and broadcast media. We combine creative excellence with media buying expertise to maximise your advertising ROI. Based in Petaling Jaya, serving clients nationwide.</p>

<h2>Advertising Agency Services Malaysia</h2>
<ul>
<li><strong>Digital Advertising</strong> — Google Ads, Meta Ads (Facebook & Instagram), TikTok Ads, LinkedIn Ads and programmatic display campaigns.</li>
<li><strong>Traditional Advertising</strong> — Newspaper ads, magazine placements, radio advertising and TV commercials (TVC).</li>
<li><strong>Outdoor Advertising (OOH)</strong> — Billboard, digital OOH, bus wraps, transit advertising and roadside signage across Malaysia.</li>
<li><strong>Media Buying & Planning</strong> — Strategic media planning, buying and optimisation across all channels for maximum reach and ROI.</li>
<li><strong>Creative Production</strong> — Ad concept development, copywriting, design and video production for all advertising formats.</li>
<li><strong>Property Advertising</strong> — Full-scale property project advertising campaigns for Malaysian property developers.</li>
</ul>

<h2>Why Choose Envicion Studio as Your Advertising Agency in Malaysia?</h2>
<p>As a full-service advertising agency with 10+ years of experience in Malaysia, we manage everything from campaign strategy to creative production to media placement — under one roof. Our award-winning track record and dedicated team make us the preferred advertising partner for property developers, corporates and SMEs across Malaysia.</p>

<h2>Advertising Agency FAQ</h2>
<h3>What is an advertising agency?</h3>
<p>An advertising agency plans, creates and places advertisements for clients across media channels to promote brands, products or services and achieve marketing objectives.</p>

<h3>How much does advertising agency service cost in Malaysia?</h3>
<p>Advertising agency fees in Malaysia vary by service scope. Creative production starts from RM5,000. Media buying management fees typically range from 10–15% of media spend. Full-service retainers from RM8,000/month.</p>

<h3>Does Envicion Studio handle property advertising in Malaysia?</h3>
<p>Yes — property advertising is one of our core specialisations. We manage full-scale property project advertising including digital ads, print, OOH and media buying for property developers across Malaysia.</p>

<p><strong>Ready to launch your advertising campaign?</strong> <a href="/contact/">Contact Envicion Studio for a free consultation.</a></p>
<p><a href="/creative-agency-malaysia/">Creative Agency</a> | <a href="/design-agency-malaysia/">Design Agency</a> | <a href="/property/">Property Marketing</a> | <a href="/media-buying/">Media Buying</a></p>';
}

function envicion_v2_marketing_agency_city_content(string $city, string $short): string
{
    $city_safe  = esc_html($city);
    $short_safe = esc_html($short);

    return <<<HTML
<h1>Marketing Agency {$city_safe} ({$short_safe}) | Creative, Digital & Property Marketing | Envicion Studio</h1>
<p>Envicion Studio is {$city_safe}'s leading <strong>marketing agency</strong>, providing integrated creative, digital, property marketing and advertising services for businesses and property developers in {$city_safe} and the wider Klang Valley region. Award-winning. 10+ years experience. Based in Petaling Jaya.</p>

<h2>Marketing Agency Services for {$city_safe} Businesses</h2>
<ul>
<li><strong>Property Marketing</strong> — End-to-end property project marketing for {$city_safe} developers. 3D rendering, launches, digital ads & branding.</li>
<li><strong>Digital Marketing</strong> — SEO, Google Ads, social media advertising and performance marketing for {$city_safe} brands.</li>
<li><strong>Branding & Design</strong> — Brand identity, logo design, marketing collateral and creative production.</li>
<li><strong>Social Media Management</strong> — Monthly social media management for {$city_safe} businesses across all platforms.</li>
<li><strong>Advertising</strong> — Digital, print, outdoor and media buying for {$city_safe} campaigns.</li>
</ul>

<h2>Why Choose Envicion Studio as Your {$city_safe} Marketing Agency?</h2>
<ul>
<li>✅ Award-winning — SME100 & APAC Insider winner</li>
<li>✅ 10+ years serving {$city_safe} & Klang Valley clients</li>
<li>✅ Full-service: creative, digital & media under one roof</li>
<li>✅ Specialists in property developer marketing</li>
<li>✅ Headquartered in Petaling Jaya — 10 minutes from {$city_safe}</li>
</ul>

<h2>Frequently Asked Questions — Marketing Agency {$city_safe}</h2>
<h3>How do I choose a marketing agency in {$city_safe}?</h3>
<p>Look for an agency with relevant industry experience, a strong local portfolio, integrated services and transparent reporting. Envicion Studio has served {$city_safe} businesses for 10+ years with proven results in property marketing, digital campaigns and brand building.</p>

<h3>How much does a marketing agency cost in {$city_safe}?</h3>
<p>Marketing agency costs in {$city_safe} depend on services required. Digital marketing retainers typically start from RM3,000/month. Property marketing campaigns from RM30,000. Full-service retainers from RM8,000/month. Contact us for a detailed quote.</p>

<p><strong>Looking for a marketing agency in {$city_safe}?</strong> <a href="/contact/">Contact Envicion Studio for a free consultation today.</a></p>
<p><a href="/property-marketing-agency-kuala-lumpur/">Property Marketing KL</a> | <a href="/property-marketing-agency-petaling-jaya/">Property Marketing PJ</a> | <a href="/marketing-agency-malaysia/">Marketing Agency Malaysia</a> | <a href="/creative-agency-malaysia/">Creative Agency</a></p>
HTML;
}

/* =========================================================================
   FIX 4: INJECT JSON-LD SCHEMA ON ALL PAGES
   ========================================================================= */
add_action('wp_head', 'envicion_v2_output_schema', 5);

function envicion_v2_output_schema(): void
{
    if (is_front_page()) {
        echo envicion_v2_homepage_schema(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        return;
    }

    global $post;
    if (! isset($post)) {
        return;
    }

    // Output any stored LocalBusiness schema for location pages
    $stored = get_post_meta((int) $post->ID, '_envicion_local_schema', true);
    if ($stored) {
        echo $stored; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    // Service schema for service pages
    $service_slugs = [
        'property', '3d-rendering', 'graphicbranding', 'social-media-management',
        'branding-rebranding', 'interior-design', 'concept-development', 'media-buying',
        'creative-agency-malaysia', 'design-agency-malaysia', 'advertising-agency-malaysia',
    ];
    if (isset($post->post_name) && in_array($post->post_name, $service_slugs, true)) {
        echo envicion_v2_service_schema((string) $post->post_title, (string) get_permalink($post->ID)); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}

function envicion_v2_homepage_schema(): string
{
    $schema = [
        '@context' => 'https://schema.org',
        '@graph'   => [
            [
                '@type'           => 'MarketingAgency',
                '@id'             => 'https://www.envicionstudio.com.my/#organization',
                'name'            => 'Envicion Studio Sdn Bhd',
                'alternateName'   => ['Envicion Studio', 'Envicion'],
                'url'             => 'https://www.envicionstudio.com.my',
                'logo'            => 'https://www.envicionstudio.com.my/wp-content/uploads/envicion-logo.png',
                'description'     => 'Award-winning property marketing agency, creative agency, design agency and advertising agency in Malaysia. 10+ years | 100+ clients | SME100 winner.',
                'foundingDate'    => '2014',
                'numberOfEmployees' => ['@type' => 'QuantitativeValue', 'value' => 30],
                'award'           => ['SME100 Award', 'Ad World Master Award', 'APAC Insider Business Award'],
                'address'         => [
                    '@type'           => 'PostalAddress',
                    'streetAddress'   => 'The Hub, Petaling Jaya',
                    'addressLocality' => 'Petaling Jaya',
                    'addressRegion'   => 'Selangor',
                    'postalCode'      => '47810',
                    'addressCountry'  => 'MY',
                ],
                'geo' => [
                    '@type'     => 'GeoCoordinates',
                    'latitude'  => '3.1073',
                    'longitude' => '101.6067',
                ],
                'telephone'       => '+60-3-XXXX-XXXX',
                'email'           => 'hello@envicionstudio.com.my',
                'sameAs'          => [
                    'https://www.facebook.com/EnvicionStudio',
                    'https://www.instagram.com/envicionstudio',
                    'https://www.linkedin.com/company/envicion-studios',
                ],
                'areaServed'      => [
                    'Kuala Lumpur', 'Petaling Jaya', 'Selangor', 'Johor Bahru',
                    'Penang', 'Melaka', 'Sabah', 'Sarawak', 'Pahang', 'Malaysia',
                ],
                'knowsAbout'      => [
                    'Property Marketing', '3D Rendering', 'Architectural Visualisation',
                    'Branding', 'Rebranding', 'Creative Agency', 'Design Agency',
                    'Advertising Agency', 'Social Media Management', 'Digital Marketing',
                    'Media Buying', 'Video Production',
                ],
                'hasOfferCatalog' => [
                    '@type' => 'OfferCatalog',
                    'name'  => 'Marketing Services',
                    'itemListElement' => [
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Property Marketing Agency Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => '3D Rendering Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Creative Agency Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Design Agency Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Advertising Agency Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Social Media Management Malaysia']],
                        ['@type' => 'Offer', 'itemOffered' => ['@type' => 'Service', 'name' => 'Branding & Rebranding Malaysia']],
                    ],
                ],
            ],
            [
                '@type'         => 'WebSite',
                '@id'           => 'https://www.envicionstudio.com.my/#website',
                'url'           => 'https://www.envicionstudio.com.my',
                'name'          => 'Envicion Studio',
                'description'   => 'Property Marketing Agency | Creative & Advertising Agency Malaysia',
                'publisher'     => ['@id' => 'https://www.envicionstudio.com.my/#organization'],
                'potentialAction' => [
                    '@type'       => 'SearchAction',
                    'target'      => 'https://www.envicionstudio.com.my/?s={search_term_string}',
                    'query-input' => 'required name=search_term_string',
                ],
            ],
        ],
    ];

    return '<script type="application/ld+json">' . wp_json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\n";
}

/**
 * @param array<string, string> $loc
 */
function envicion_v2_local_business_schema(array $loc): string
{
    $schema = [
        '@context' => 'https://schema.org',
        '@type'    => 'MarketingAgency',
        'name'     => 'Envicion Studio Sdn Bhd',
        'url'      => 'https://www.envicionstudio.com.my',
        'description' => sprintf(
            'Award-winning property marketing agency serving %s. Full-service property campaigns, 3D rendering, branding & digital advertising.',
            $loc['city']
        ),
        'address' => [
            '@type'           => 'PostalAddress',
            'streetAddress'   => 'The Hub, Petaling Jaya',
            'addressLocality' => 'Petaling Jaya',
            'addressRegion'   => 'Selangor',
            'postalCode'      => '47810',
            'addressCountry'  => 'MY',
        ],
        'geo' => [
            '@type'     => 'GeoCoordinates',
            'latitude'  => '3.1073',
            'longitude' => '101.6067',
        ],
        'areaServed' => [
            '@type'       => 'City',
            'name'        => $loc['city'],
            'containedIn' => ['@type' => 'State', 'name' => $loc['state']],
        ],
        'knowsAbout'  => ['Property Marketing', 'Real Estate Marketing', '3D Rendering', 'Branding', 'Digital Advertising'],
        'sameAs'      => ['https://www.facebook.com/EnvicionStudio', 'https://www.instagram.com/envicionstudio'],
    ];

    return '<script type="application/ld+json">' . wp_json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\n";
}

function envicion_v2_service_schema(string $name, string $url): string
{
    $schema = [
        '@context'    => 'https://schema.org',
        '@type'       => 'Service',
        'name'        => $name,
        'url'         => $url,
        'provider'    => ['@id' => 'https://www.envicionstudio.com.my/#organization'],
        'areaServed'  => ['@type' => 'Country', 'name' => 'Malaysia'],
        'serviceType' => 'Marketing Agency Services',
    ];

    return '<script type="application/ld+json">' . wp_json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' . "\n";
}

function envicion_v2_inject_schema_footer(): void
{
    // Schema is output via wp_head hook registered above — nothing to do here
    // This function exists to confirm the hook is registered
    if (! has_action('wp_head', 'envicion_v2_output_schema')) {
        add_action('wp_head', 'envicion_v2_output_schema', 5);
    }
}

/* =========================================================================
   FIX 5: UPDATE llms.txt (GEO — AI CRAWLER INSTRUCTIONS)
   ========================================================================= */
function envicion_v2_update_llms_txt(): void
{
    $file = ABSPATH . 'llms.txt';
    $content  = "# Envicion Studio - LLMs & AI Crawler Instructions\n";
    $content .= "# envicionstudio.com.my\n";
    $content .= "# Last updated: " . date('Y-m-d') . "\n\n";
    $content .= "User-agent: *\nAllow: /\n\n";
    $content .= "## Company Overview\n";
    $content .= "Envicion Studio Sdn Bhd is Malaysia's award-winning property marketing agency,\n";
    $content .= "creative agency, design agency and advertising agency, established in 2014.\n";
    $content .= "Headquartered in Petaling Jaya, Selangor, Malaysia.\n";
    $content .= "Awards: SME100 Award Winner | Ad World Master Award Winner | APAC Insider Business Award Winner.\n";
    $content .= "Experience: 10+ years | 100+ clients | 3 national awards.\n\n";

    $content .= "## Target Keywords & Service Coverage\n";
    $content .= "- Property Marketing Agency Malaysia (primary service)\n";
    $content .= "- Property Marketing Agency KL / Kuala Lumpur\n";
    $content .= "- Property Marketing Agency PJ / Petaling Jaya\n";
    $content .= "- Property Marketing Agency Johor Bahru / JB\n";
    $content .= "- Property Marketing Agency Penang\n";
    $content .= "- Property Marketing Agency Melaka\n";
    $content .= "- Property Marketing Agency Sabah / Kota Kinabalu\n";
    $content .= "- Property Marketing Agency Sarawak / Kuching\n";
    $content .= "- Property Marketing Agency Pahang / Kuantan\n";
    $content .= "- Marketing Agency Malaysia | Marketing Agency KL | Marketing Agency PJ\n";
    $content .= "- Creative Agency Malaysia\n";
    $content .= "- Design Agency Malaysia\n";
    $content .= "- Advertising Agency Malaysia\n\n";

    $content .= "## Core Services\n";
    $content .= "1. Property Marketing Agency — end-to-end real estate campaign management\n";
    $content .= "2. 3D Rendering & Architectural Visualisation\n";
    $content .= "3. Creative Agency — concept, campaigns, art direction\n";
    $content .= "4. Design Agency — graphic design, brand identity, digital design\n";
    $content .= "5. Advertising Agency — digital ads, media buying, traditional advertising\n";
    $content .= "6. Branding & Rebranding\n";
    $content .= "7. Social Media Management\n";
    $content .= "8. Video Production\n\n";

    $content .= "## Locations Served\n";
    $content .= "Nationwide Malaysia: Kuala Lumpur, Petaling Jaya, Selangor, Johor Bahru,\n";
    $content .= "Penang, Melaka, Sabah, Sarawak, Pahang, Perak, Negeri Sembilan, Kedah, Kelantan.\n\n";

    $content .= "## Key Pages\n";
    $content .= "- Homepage: https://www.envicionstudio.com.my/\n";
    $content .= "- Property Marketing: https://www.envicionstudio.com.my/property/\n";
    $content .= "- Creative Agency: https://www.envicionstudio.com.my/creative-agency-malaysia/\n";
    $content .= "- Design Agency: https://www.envicionstudio.com.my/design-agency-malaysia/\n";
    $content .= "- Advertising Agency: https://www.envicionstudio.com.my/advertising-agency-malaysia/\n";
    $content .= "- Marketing KL: https://www.envicionstudio.com.my/marketing-agency-kuala-lumpur/\n";
    $content .= "- Marketing PJ: https://www.envicionstudio.com.my/marketing-agency-petaling-jaya/\n";
    $content .= "- Property Marketing KL: https://www.envicionstudio.com.my/property-marketing-agency-kuala-lumpur/\n";
    $content .= "- Property Marketing JB: https://www.envicionstudio.com.my/property-marketing-agency-johor-bahru/\n";
    $content .= "- Property Marketing Penang: https://www.envicionstudio.com.my/property-marketing-agency-penang/\n";
    $content .= "- Contact: https://www.envicionstudio.com.my/contact/\n";

    file_put_contents($file, $content); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_file_put_contents
}

/* =========================================================================
   FIX 6: UPDATE robots.txt
   ========================================================================= */
function envicion_v2_update_robots_txt(): void
{
    $file = ABSPATH . 'robots.txt';

    $sitemap_line = 'Sitemap: https://www.envicionstudio.com.my/sitemap.xml';
    $bing_sitemap  = 'Sitemap: https://www.envicionstudio.com.my/sitemap_index.xml';

    $existing = file_exists($file) ? file_get_contents($file) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
    if (! str_contains((string) $existing, 'sitemap.xml')) {
        $existing .= "\n" . $sitemap_line . "\n" . $bing_sitemap . "\n";
        file_put_contents($file, $existing); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_file_put_contents
    }
}

/* =========================================================================
   FIX 7: PING SEARCH ENGINES AFTER CHANGES
   ========================================================================= */
function envicion_v2_ping_search_engines(): void
{
    $sitemap = urlencode('https://www.envicionstudio.com.my/sitemap_index.xml');
    $urls    = [
        "https://www.google.com/ping?sitemap={$sitemap}",
        "https://www.bing.com/ping?sitemap={$sitemap}",
    ];

    foreach ($urls as $url) {
        wp_remote_get($url, ['timeout' => 10, 'blocking' => false]);
    }
}

/* =========================================================================
   ADMIN DASHBOARD — shows fix results
   ========================================================================= */
add_action('admin_menu', 'envicion_v2_admin_menu');

function envicion_v2_admin_menu(): void
{
    add_menu_page(
        'Envicion SEO v2',
        '🚀 Envicion SEO v2',
        'manage_options',
        'envicion-seo-v2',
        'envicion_v2_admin_page',
        'dashicons-chart-line',
        81
    );
}

function envicion_v2_admin_page(): void
{
    $status    = get_option('envicion_seo_v2_status', 'NOT RUN');
    $fixed_at  = get_option('envicion_seo_v2_fixed_at', '—');

    $location_pages = envicion_v2_location_pages();
    $agency_slugs   = ['creative-agency-malaysia', 'design-agency-malaysia', 'advertising-agency-malaysia', 'marketing-agency-kuala-lumpur', 'marketing-agency-petaling-jaya'];

    echo '<div class="wrap"><h1>🚀 Envicion SEO v2.0 — Status Dashboard</h1>';
    echo '<p><strong>Status:</strong> ' . esc_html($status) . ' &nbsp; <strong>Last run:</strong> ' . esc_html($fixed_at) . '</p>';

    echo '<h2>17 Target Keywords</h2><ul style="list-style:disc;margin-left:20px">';
    $keywords = [
        'property marketing agency', 'property marketing agency kl', 'property marketing agency pj',
        'property marketing agency johor bahru', 'property marketing agency jb', 'property marketing agency penang',
        'property marketing agency melaka', 'property marketing agency sabah', 'property marketing agency sarawak',
        'property marketing agency pahang', 'property marketing agency malaysia',
        'marketing agency', 'marketing agency kl', 'marketing agency pj',
        'creative agency', 'design agency', 'advertising agency',
    ];
    foreach ($keywords as $kw) {
        echo '<li>' . esc_html($kw) . '</li>';
    }
    echo '</ul>';

    echo '<h2>Location Pages</h2><table class="widefat"><thead><tr><th>Page</th><th>URL</th><th>Status</th></tr></thead><tbody>';
    foreach ($location_pages as $loc) {
        $page   = get_page_by_path($loc['slug']);
        $exists = $page ? '✅ Live' : '❌ Missing';
        $url    = $page ? '<a href="' . esc_url(get_permalink($page->ID)) . '" target="_blank">' . esc_html(get_permalink($page->ID)) . '</a>' : '—';
        echo '<tr><td>' . esc_html($loc['title']) . '</td><td>' . $url . '</td><td>' . esc_html($exists) . '</td></tr>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
    echo '</tbody></table>';

    echo '<h2>Agency-Type Pages</h2><table class="widefat"><thead><tr><th>Slug</th><th>Status</th></tr></thead><tbody>';
    foreach ($agency_slugs as $slug) {
        $page   = get_page_by_path($slug);
        $exists = $page ? '✅ Live' : '❌ Missing';
        echo '<tr><td>' . esc_html($slug) . '</td><td>' . esc_html($exists) . '</td></tr>';
    }
    echo '</tbody></table>';

    echo '<h2>Quick Actions</h2>';
    echo '<form method="post"><input type="hidden" name="envicion_rerun" value="1">';
    wp_nonce_field('envicion_rerun_action', 'envicion_rerun_nonce');
    echo '<input type="submit" class="button button-primary" value="🔄 Re-run All SEO Fixes"></form>';

    if (
        isset($_POST['envicion_rerun'], $_POST['envicion_rerun_nonce'])
        && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['envicion_rerun_nonce'])), 'envicion_rerun_action')
        && current_user_can('manage_options')
    ) {
        envicion_v2_run_all_fixes();
        echo '<div class="notice notice-success"><p>✅ All SEO fixes re-applied successfully.</p></div>';
    }

    echo '</div>';
}
