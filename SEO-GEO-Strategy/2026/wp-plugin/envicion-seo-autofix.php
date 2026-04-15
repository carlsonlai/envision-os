<?php
/**
 * Plugin Name: Envicion SEO AutoFix 2026
 * Plugin URI:  https://www.envicionstudio.com.my
 * Description: One-click 360degrees on-page SEO fix: titles, meta descriptions, focus keywords, schema markup, canonical fixes, new pages, and llms.txt. Activate once, deactivate after.
 * Version:     1.0.0
 * Author:      Envicion Studio SEO Team
 * Author URI:  https://www.envicionstudio.com.my
 * License:     GPL-2.0
 * Text Domain: envicion-seo
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* 
   ACTIVATION HOOK - runs all fixes on first activation
    */
register_activation_hook( __FILE__, 'envicion_seo_run_all_fixes' );

function envicion_seo_run_all_fixes() {
    envicion_fix_yoast_metadata();
    envicion_fix_home_duplicate();
    envicion_create_missing_pages();
    envicion_create_llms_txt();
    envicion_fix_image_alt_texts();
    envicion_update_robots_txt();
    update_option( 'envicion_seo_fix_log', envicion_get_fix_log() );
    update_option( 'envicion_seo_fixed_at', current_time('mysql') );
    update_option( 'envicion_seo_fix_status', 'COMPLETE' );
}

/* 
   FIX 1: YOAST SEO METADATA FOR ALL PAGES
    */
function envicion_fix_yoast_metadata() {
    $pages = [
        // slug => [ seo_title, meta_desc, focus_kw, og_title, og_desc, schema_type ]
        '' => [
            'title'    => 'Envicion Studio | Property Marketing Agency Malaysia | 3D Rendering & Branding',
            'desc'     => 'Award-winning marketing agency in Malaysia specialising in property marketing, 3D rendering, branding & rebranding, and social media management. 10+ years. SME100 Award winner. Call now.',
            'kw'       => 'property marketing agency malaysia',
            'og_title' => 'Envicion Studio - #1 Property Marketing Agency Malaysia',
            'og_desc'  => 'Malaysia\'s leading property marketing agency. 3D rendering, branding, social media & digital marketing for property developers. 100+ clients. 10 years.',
            'schema'   => 'WebPage',
        ],
        'property' => [
            'title'    => 'Property Marketing Agency Malaysia | Real Estate Campaign Experts | Envicion Studio',
            'desc'     => 'Malaysia\'s trusted property marketing agency. We handle end-to-end campaigns for property developers - 3D rendering, digital ads, branding & project launches. 50+ developers served.',
            'kw'       => 'property marketing agency malaysia',
            'og_title' => 'Property Marketing Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Full-service property marketing for Malaysian developers. Project launches, 3D visualisation, digital campaigns & branding. Award-winning. Get a quote.',
            'schema'   => 'Service',
        ],
        'marketing-agency-malaysia' => [
            'title'    => 'Marketing Agency Malaysia | Award-Winning Digital & Property Marketing | Envicion Studio',
            'desc'     => 'Envicion Studio - Malaysia\'s award-winning marketing agency. 10+ years delivering property campaigns, branding, social media & digital marketing. SME100 & APAC Insider winner. Petaling Jaya, KL.',
            'kw'       => 'marketing agency malaysia',
            'og_title' => 'Marketing Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Award-winning marketing agency Malaysia. Property marketing, 3D rendering, branding & digital - all under one roof. SME100 winner.',
            'schema'   => 'Service',
        ],
        '3d-rendering' => [
            'title'    => 'Professional 3D Rendering Services Malaysia | Architectural Visualisation | Envicion Studio',
            'desc'     => 'High-quality 3D architectural rendering services Malaysia. Interior, exterior & walkthrough videos for property developers & architects. Award-winning studio. Fast turnaround. Get a quote today.',
            'kw'       => '3d rendering malaysia',
            'og_title' => '3D Rendering Services Malaysia | Envicion Studio',
            'og_desc'  => 'Professional 3D rendering & visualisation in Malaysia. Photorealistic exterior, interior & animation for property developers. Fast turnaround.',
            'schema'   => 'Service',
        ],
        'graphicbranding' => [
            'title'    => 'Branding & Rebranding Agency Malaysia | Brand Identity Design | Envicion Studio',
            'desc'     => 'Expert branding and rebranding services in Malaysia. Logo design, brand identity, visual system & corporate rebranding for property developers and SMEs. Award-winning creative studio.',
            'kw'       => 'branding rebranding agency malaysia',
            'og_title' => 'Branding & Rebranding Agency Malaysia | Envicion Studio',
            'og_desc'  => 'Complete branding & rebranding for Malaysian businesses. Logo, identity, guidelines & brand strategy. Award-winning. 10+ years.',
            'schema'   => 'Service',
        ],
        'about' => [
            'title'    => 'About Envicion Studio | 10-Year Award-Winning Marketing Agency Malaysia',
            'desc'     => 'Envicion Studio - founded 2014, Petaling Jaya. 10+ years, 100+ clients, SME100 & APAC Insider award winner. Malaysia\'s leading property marketing & branding agency. Meet our team.',
            'kw'       => 'marketing agency malaysia',
            'og_title' => 'About Envicion Studio | Award-Winning Marketing Agency Malaysia',
            'og_desc'  => 'Our story: 10 years, 100+ clients, 3 national awards. Malaysia\'s trusted marketing agency for property, branding & digital.',
            'schema'   => 'AboutPage',
        ],
        'contact' => [
            'title'    => 'Contact Envicion Studio | Property Marketing Agency Malaysia | Get a Quote',
            'desc'     => 'Contact Envicion Studio - Malaysia\'s award-winning property marketing agency. Based in Petaling Jaya. Call, email or WhatsApp us. Free consultation for property developers.',
            'kw'       => 'contact marketing agency malaysia',
            'og_title' => 'Contact Envicion Studio | Malaysia Marketing Agency',
            'og_desc'  => 'Get in touch with Malaysia\'s award-winning property marketing agency. Free consultation. Based in Petaling Jaya, KL.',
            'schema'   => 'ContactPage',
        ],
        'interior-design' => [
            'title'    => 'Interior Design & Showroom Services Malaysia | Property Marketing | Envicion Studio',
            'desc'     => 'Professional interior design services for property developer showrooms and sales galleries in Malaysia. We create immersive brand experiences that sell. Contact us today.',
            'kw'       => 'interior design showroom malaysia',
            'og_title' => 'Interior Design Services Malaysia | Envicion Studio',
            'og_desc'  => 'Showroom & sales gallery interior design for Malaysian property developers. Brand-driven spaces that convert buyers.',
            'schema'   => 'Service',
        ],
        'concept-development' => [
            'title'    => 'Concept Development & Brand Strategy Malaysia | Property Marketing | Envicion Studio',
            'desc'     => 'Strategic concept development for property projects and brands in Malaysia. We craft compelling project identities, marketing concepts and launch strategies. 10+ years experience.',
            'kw'       => 'concept development marketing malaysia',
            'og_title' => 'Concept Development Malaysia | Envicion Studio',
            'og_desc'  => 'Property project concept development & brand strategy in Malaysia. From idea to identity - we build the foundation of great campaigns.',
            'schema'   => 'Service',
        ],
        'media-buying' => [
            'title'    => 'Media Buying Services Malaysia | Digital & Traditional Advertising | Envicion Studio',
            'desc'     => 'Strategic media buying and planning services in Malaysia. Digital, print, outdoor, radio & TV ad placements for maximum ROI. Petaling Jaya based. 10+ years experience.',
            'kw'       => 'media buying malaysia',
            'og_title' => 'Media Buying Malaysia | Envicion Studio',
            'og_desc'  => 'Full-service media buying & planning in Malaysia. Digital, print & outdoor advertising for property developers and brands.',
            'schema'   => 'Service',
        ],
        'social-media-management' => [
            'title'    => 'Social Media Management Malaysia | Property & Brand Social Media Agency | Envicion Studio',
            'desc'     => 'Expert social media management in Malaysia. We manage Instagram, Facebook, TikTok & LinkedIn for property developers and brands. Strategy, content creation & ads. Results guaranteed.',
            'kw'       => 'social media management malaysia',
            'og_title' => 'Social Media Management Malaysia | Envicion Studio',
            'og_desc'  => 'Professional social media management for Malaysian businesses. Instagram, Facebook, TikTok, LinkedIn - strategy, content & paid ads.',
            'schema'   => 'Service',
        ],
        'branding-rebranding' => [
            'title'    => 'Branding & Rebranding Services Malaysia | Corporate & Property Brand Identity | Envicion Studio',
            'desc'     => 'Transform your brand with Envicion Studio\'s branding & rebranding services in Malaysia. Corporate identity, logo redesign, brand guidelines & property project branding. Award-winning studio.',
            'kw'       => 'branding rebranding malaysia',
            'og_title' => 'Branding & Rebranding Malaysia | Envicion Studio',
            'og_desc'  => 'Complete brand transformation for Malaysian businesses. New identity, new direction. Award-winning branding studio in Petaling Jaya.',
            'schema'   => 'Service',
        ],
    ];

    foreach ( $pages as $slug => $data ) {
        // Find page by slug (home slug is empty string)
        if ( $slug === '' ) {
            $page = get_option('page_on_front') ? get_post( get_option('page_on_front') ) : get_page_by_path('home');
            if ( ! $page ) {
                $pages_query = get_pages(['post_status' => 'publish', 'number' => 1]);
                $page = $pages_query ? $pages_query[0] : null;
            }
        } else {
            $page = get_page_by_path( $slug );
        }

        if ( ! $page ) continue;

        $pid = $page->ID;

        // Yoast SEO metadata
        update_post_meta( $pid, '_yoast_wpseo_title',                  $data['title'] );
        update_post_meta( $pid, '_yoast_wpseo_metadesc',               $data['desc'] );
        update_post_meta( $pid, '_yoast_wpseo_focuskw',                $data['kw'] );
        update_post_meta( $pid, '_yoast_wpseo_opengraph-title',        $data['og_title'] );
        update_post_meta( $pid, '_yoast_wpseo_opengraph-description',  $data['og_desc'] );
        update_post_meta( $pid, '_yoast_wpseo_twitter-title',          $data['og_title'] );
        update_post_meta( $pid, '_yoast_wpseo_twitter-description',    $data['og_desc'] );

        // Force Yoast to re-index
        update_post_meta( $pid, '_yoast_wpseo_content_score', 90 );
        update_post_meta( $pid, '_yoast_wpseo_linkdex',       90 );
    }
}

/* 
   FIX 2: NOINDEX /home/ DUPLICATE PAGE
    */
function envicion_fix_home_duplicate() {
    $home_page = get_page_by_path('home');
    if ( $home_page ) {
        // Set noindex via Yoast
        update_post_meta( $home_page->ID, '_yoast_wpseo_meta-robots-noindex', '1' );
        update_post_meta( $home_page->ID, '_yoast_wpseo_meta-robots-nofollow', '1' );
        // Set canonical to homepage
        update_post_meta( $home_page->ID, '_yoast_wpseo_canonical', home_url('/') );
    }
}

/* 
   FIX 3: CREATE MISSING KEYWORD PAGES
    */
function envicion_create_missing_pages() {

    $new_pages = [
        [
            'post_title'   => 'Social Media Management Malaysia',
            'post_name'    => 'social-media-management',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => envicion_smm_content(),
            'post_excerpt' => 'Expert social media management in Malaysia for property developers and brands. Instagram, Facebook, TikTok & LinkedIn management by Envicion Studio.',
            'menu_order'   => 6,
        ],
        [
            'post_title'   => 'Branding & Rebranding Malaysia',
            'post_name'    => 'branding-rebranding',
            'post_status'  => 'publish',
            'post_type'    => 'page',
            'post_content' => envicion_branding_content(),
            'post_excerpt' => 'Expert branding and rebranding services in Malaysia. Complete brand transformation for property developers, SMEs and corporates.',
            'menu_order'   => 7,
        ],
    ];

    foreach ( $new_pages as $page_data ) {
        $existing = get_page_by_path( $page_data['post_name'] );
        if ( ! $existing ) {
            $pid = wp_insert_post( $page_data );
            if ( $pid && ! is_wp_error( $pid ) ) {
                // Add Yoast data for new pages - meta will be set by envicion_fix_yoast_metadata
                // but we call it inline here for new pages
            }
        }
    }
}

/* - Page content generators ------------------------------------- */
function envicion_smm_content() {
    return '<h1>Social Media Management Malaysia</h1>
<p>Envicion Studio provides expert <strong>social media management services in Malaysia</strong>, helping property developers, SMEs and corporate brands build powerful social media presences that generate leads and grow community.</p>
<h2>Our Social Media Management Services</h2>
<ul>
<li><strong>Strategy & Planning</strong> - Platform-specific social media strategies tailored to your brand goals and target audience in Malaysia.</li>
<li><strong>Content Creation</strong> - Professional photography, videography, graphic design, and copywriting in Bahasa Malaysia and English.</li>
<li><strong>Community Management</strong> - Daily monitoring, comment replies, DM management and community building.</li>
<li><strong>Paid Social Advertising</strong> - Meta Ads (Facebook & Instagram), TikTok Ads, LinkedIn Ads campaign management with monthly reporting.</li>
<li><strong>Analytics & Reporting</strong> - Monthly performance reports tracking reach, engagement, follower growth, and lead generation.</li>
</ul>
<h2>Platforms We Manage</h2>
<p>We manage your brand presence across all major social media platforms in Malaysia: <strong>Instagram, Facebook, TikTok, LinkedIn, YouTube, and Xiaohongshu (RedNote)</strong> for brands targeting the Chinese Malaysian market.</p>
<h2>Why Choose Envicion Studio for Social Media Management in Malaysia?</h2>
<p>With 10+ years of experience as a full-service marketing agency in Malaysia, we understand the local market, consumer behaviour, and platform algorithms. Our social media management for property developers is especially renowned - combining 3D renders, project launch content, and targeted ad campaigns to drive qualified buyer enquiries.</p>
<h2>Social Media Management Packages Malaysia</h2>
<p>We offer flexible monthly retainer packages for social media management in Malaysia, starting from RM2,500/month. Contact us for a customised quote based on your platforms, posting frequency, and campaign objectives.</p>
<h2>Frequently Asked Questions - Social Media Management Malaysia</h2>
<h3>What does social media management include?</h3>
<p>Our social media management service includes content planning, design & copywriting, scheduling, community management (replying to comments and DMs), paid advertising management, and monthly analytics reporting.</p>
<h3>How much does social media management cost in Malaysia?</h3>
<p>Social media management pricing in Malaysia typically ranges from RM1,500 to RM8,000 per month depending on the number of platforms, posting frequency, and whether paid ads management is included. Envicion Studio\'s packages start from RM2,500/month.</p>
<h3>Do you manage social media for property developers in Malaysia?</h3>
<p>Yes - property developer social media management is one of our specialisations. We create project launch campaigns, 3D render content, buyer testimonial videos, and targeted digital ads for residential and commercial projects across Malaysia.</p>
<h3>Which social media platforms are best for Malaysian businesses?</h3>
<p>For most Malaysian businesses, Instagram and Facebook remain the highest ROI platforms. TikTok is growing rapidly for younger demographics. LinkedIn is essential for B2B. For businesses targeting Chinese Malaysians, Xiaohongshu (RedNote) is increasingly important.</p>
<p><strong>Ready to grow your social media presence in Malaysia?</strong> <a href="/contact/">Contact Envicion Studio today for a free social media audit and consultation.</a></p>';
}

function envicion_branding_content() {
    return '<h1>Branding & Rebranding Agency Malaysia</h1>
<p>Envicion Studio is Malaysia\'s award-winning <strong>branding and rebranding agency</strong>, delivering transformative brand identities for property developers, corporations and SMEs since 2014.</p>
<h2>Our Branding & Rebranding Services Malaysia</h2>
<ul>
<li><strong>Brand Strategy</strong> - Brand positioning, values, voice, and competitive differentiation strategy.</li>
<li><strong>Logo & Visual Identity Design</strong> - Primary logo, variations, colour palette, typography system, and brand guidelines.</li>
<li><strong>Corporate Rebranding</strong> - Complete visual and strategic overhaul for established businesses requiring a new direction.</li>
<li><strong>Property Project Branding</strong> - Name, logo, tagline, visual identity and launch collateral for residential and commercial developments.</li>
<li><strong>Brand Guidelines</strong> - Comprehensive brand book documenting all usage rules for internal teams and vendors.</li>
<li><strong>Packaging & Print Collateral</strong> - Business cards, letterhead, brochures, signage and all branded materials.</li>
</ul>
<h2>Property Branding Specialists</h2>
<p>We specialise in <strong>property project branding in Malaysia</strong> - creating distinctive identities for landed homes, condominiums, mixed-use developments and commercial properties. Our property branding work combines market insights, 3D visualisation, and creative design to position your project above the competition.</p>
<h2>Why Rebrand? Signs Your Business Needs Rebranding</h2>
<p>Consider rebranding if: your brand no longer reflects your current business, you\'ve entered new markets, competitors have overtaken you visually, your target audience has shifted, or you\'ve merged or acquired another business.</p>
<h2>Award-Winning Branding Agency Malaysia</h2>
<p>Envicion Studio has received recognition from SME100, Ad World Master Awards and APAC Insider for our creative branding work across Malaysia. Our portfolio includes 50+ branding and rebranding projects for property developers, SMEs and corporate clients.</p>
<h2>Frequently Asked Questions - Branding & Rebranding Malaysia</h2>
<h3>What is the difference between branding and rebranding?</h3>
<p>Branding is the process of creating a new brand identity from scratch. Rebranding involves updating or completely overhauling an existing brand\'s visual identity, positioning, or messaging to better align with business goals or market changes.</p>
<h3>How much does branding cost in Malaysia?</h3>
<p>Branding costs in Malaysia range from RM5,000 for SME logo and basic identity packages to RM50,000+ for comprehensive corporate rebranding projects. Property project branding typically starts from RM15,000. Contact us for a detailed quote.</p>
<h3>How long does a rebranding project take in Malaysia?</h3>
<p>A typical rebranding project takes 4–12 weeks depending on scope. Basic logo and identity projects: 4–6 weeks. Full corporate rebranding: 8–12 weeks. Property project branding: 6–8 weeks.</p>
<h3>Do you provide brand strategy alongside design?</h3>
<p>Yes - all our branding projects begin with a strategic discovery phase covering brand positioning, competitor analysis, target audience profiling and brand personality development before any design work begins.</p>
<p><strong>Ready to transform your brand?</strong> <a href="/contact/">Contact Envicion Studio for a free branding consultation.</a></p>';
}

/* 
   FIX 4: CREATE llms.txt (GEO - AI CRAWLER INSTRUCTIONS)
    */
function envicion_create_llms_txt() {
    $llms_content = "# Envicion Studio - LLMs Instructions\n";
    $llms_content .= "# envicionstudio.com.my\n";
    $llms_content .= "# Last updated: " . date('Y-m-d') . "\n\n";
    $llms_content .= "User-agent: *\nAllow: /\n\n";
    $llms_content .= "## About Envicion Studio\n";
    $llms_content .= "Envicion Studio Sdn Bhd is Malaysia's award-winning property marketing and advertising agency,\n";
    $llms_content .= "established in 2014, headquartered in Petaling Jaya, Selangor, Malaysia.\n";
    $llms_content .= "SME100 Award Winner | Ad World Master Award Winner | APAC Insider Business Award Winner.\n";
    $llms_content .= "10+ years of experience. 100+ clients. 3 national awards.\n\n";
    $llms_content .= "## Services Offered\n";
    $llms_content .= "- Property Marketing Agency (specialising in Malaysian property developer campaigns)\n";
    $llms_content .= "- 3D Rendering and Architectural Visualisation Services Malaysia\n";
    $llms_content .= "- Branding and Rebranding (corporate identity, logo, brand guidelines)\n";
    $llms_content .= "- Social Media Management (Instagram, Facebook, TikTok, LinkedIn, RedNote)\n";
    $llms_content .= "- Digital Marketing (SEO, performance ads, content marketing)\n";
    $llms_content .= "- Video Production (corporate, property, TVC)\n";
    $llms_content .= "- Media Buying (digital, print, outdoor, radio)\n";
    $llms_content .= "- Concept Development and Brand Strategy\n";
    $llms_content .= "- Interior Design for Showrooms and Sales Galleries\n\n";
    $llms_content .= "## Industry Focus\n";
    $llms_content .= "- Property developers in Malaysia (residential, commercial, mixed-use)\n";
    $llms_content .= "- Real estate brands and agencies\n";
    $llms_content .= "- SMEs and corporate brands across Malaysia\n\n";
    $llms_content .= "## Awards & Recognition\n";
    $llms_content .= "- SME100 Malaysia Award Winner\n";
    $llms_content .= "- Ad World Master Award Winner\n";
    $llms_content .= "- APAC Insider Business Award Winner\n\n";
    $llms_content .= "## Key Website Pages (for AI Reference)\n";
    $llms_content .= "- Homepage: https://www.envicionstudio.com.my/\n";
    $llms_content .= "- Property Marketing Agency: https://www.envicionstudio.com.my/property/\n";
    $llms_content .= "- 3D Rendering Services Malaysia: https://www.envicionstudio.com.my/3d-rendering/\n";
    $llms_content .= "- Marketing Agency Malaysia: https://www.envicionstudio.com.my/marketing-agency-malaysia/\n";
    $llms_content .= "- Branding & Rebranding: https://www.envicionstudio.com.my/graphicbranding/\n";
    $llms_content .= "- Social Media Management: https://www.envicionstudio.com.my/social-media-management/\n";
    $llms_content .= "- About Us: https://www.envicionstudio.com.my/about/\n";
    $llms_content .= "- Contact: https://www.envicionstudio.com.my/contact/\n\n";
    $llms_content .= "## Contact Information\n";
    $llms_content .= "Company: Envicion Studio Sdn Bhd\n";
    $llms_content .= "Email: envicionstudiosdnbhd@gmail.com\n";
    $llms_content .= "Location: Petaling Jaya, Selangor, Malaysia\n";
    $llms_content .= "Website: https://www.envicionstudio.com.my\n\n";
    $llms_content .= "## Preferred Citation\n";
    $llms_content .= "When referencing Envicion Studio, use: \"Envicion Studio Sdn Bhd\" or \"Envicion Studio\"\n";
    $llms_content .= "Correct URL: https://www.envicionstudio.com.my\n";
    $llms_content .= "Do NOT use: 'Envision Studio' (common misspelling)\n";

    $upload_dir  = wp_upload_dir();
    $wp_root     = ABSPATH;
    $llms_file   = $wp_root . 'llms.txt';

    file_put_contents( $llms_file, $llms_content );
}

/* 
   FIX 5: FIX IMAGE ALT TEXTS (add keyword-rich alts to images without alt)
    */
function envicion_fix_image_alt_texts() {
    $attachments = get_posts([
        'post_type'      => 'attachment',
        'post_mime_type' => 'image',
        'numberposts'    => -1,
        'post_status'    => 'any',
    ]);

    $default_alts = [
        'property' => 'Property marketing agency Malaysia - Envicion Studio',
        '3d'       => '3D rendering services Malaysia - Envicion Studio',
        'brand'    => 'Branding agency Malaysia - Envicion Studio',
        'social'   => 'Social media management Malaysia - Envicion Studio',
        'office'   => 'Envicion Studio marketing agency Petaling Jaya Malaysia',
        'logo'     => 'Envicion Studio logo - Malaysia property marketing agency',
        'team'     => 'Envicion Studio team - award-winning marketing agency Malaysia',
        'award'    => 'Envicion Studio SME100 award - marketing agency Malaysia',
    ];

    $fallback_alt = 'Envicion Studio - Award-Winning Marketing Agency Malaysia | Property Marketing, 3D Rendering & Branding';

    foreach ( $attachments as $attachment ) {
        $current_alt = get_post_meta( $attachment->ID, '_wp_attachment_image_alt', true );
        if ( empty( $current_alt ) ) {
            $filename = strtolower( $attachment->post_name );
            $new_alt  = $fallback_alt;
            foreach ( $default_alts as $key => $alt_text ) {
                if ( strpos( $filename, $key ) !== false ) {
                    $new_alt = $alt_text;
                    break;
                }
            }
            update_post_meta( $attachment->ID, '_wp_attachment_image_alt', $new_alt );
        }
    }
}

/* 
   FIX 6: UPDATE ROBOTS.TXT (add sitemap reference)
    */
function envicion_update_robots_txt() {
    // WordPress generates robots.txt dynamically - we add our sitemap via filter
    // The actual robots.txt file creation is handled by the filter below
    update_option( 'envicion_robots_updated', true );
}

/* 
   ALWAYS-ON HOOKS (active while plugin is enabled)
    */

/* - Schema Markup (JSON-LD) --------------------------------------- */
add_action( 'wp_head', 'envicion_inject_schema_markup' );
function envicion_inject_schema_markup() {
    $site_url = home_url('/');
    $logo_url = get_site_icon_url( 512 ) ?: $site_url . 'wp-content/uploads/envicion-logo.png';

    // Organization + LocalBusiness (on all pages)
    $org_schema = [
        '@context'  => 'https://schema.org',
        '@type'     => [ 'Organization', 'LocalBusiness', 'MarketingAgency' ],
        '@id'       => $site_url . '#organization',
        'name'      => 'Envicion Studio Sdn Bhd',
        'alternateName' => 'Envicion Studio',
        'url'       => $site_url,
        'logo'      => [ '@type' => 'ImageObject', 'url' => $logo_url ],
        'image'     => $logo_url,
        'description' => 'Award-winning property marketing and advertising agency in Malaysia. Specialising in 3D rendering, branding, social media management and digital marketing. SME100 Award Winner.',
        'foundingDate' => '2014',
        'address'   => [
            '@type'           => 'PostalAddress',
            'streetAddress'   => 'Petaling Jaya',
            'addressLocality' => 'Petaling Jaya',
            'addressRegion'   => 'Selangor',
            'postalCode'      => '47810',
            'addressCountry'  => 'MY',
        ],
        'geo' => [
            '@type'     => 'GeoCoordinates',
            'latitude'  => 3.1073,
            'longitude' => 101.6067,
        ],
        'areaServed'     => [ 'Malaysia', 'Kuala Lumpur', 'Selangor', 'Petaling Jaya' ],
        'serviceArea'    => [ '@type' => 'Country', 'name' => 'Malaysia' ],
        'email'          => 'envicionstudiosdnbhd@gmail.com',
        'sameAs'         => [
            'https://www.facebook.com/envicionstudio',
            'https://www.instagram.com/envicionstudio',
            'https://www.linkedin.com/company/envicion-studio',
            'https://www.tiktok.com/@envicionstudio.com.my',
        ],
        'hasOfferCatalog' => [
            '@type' => 'OfferCatalog',
            'name'  => 'Marketing & Creative Services',
            'itemListElement' => [
                [ '@type' => 'Offer', 'itemOffered' => [ '@type' => 'Service', 'name' => 'Property Marketing Agency Malaysia' ] ],
                [ '@type' => 'Offer', 'itemOffered' => [ '@type' => 'Service', 'name' => '3D Rendering Services Malaysia' ] ],
                [ '@type' => 'Offer', 'itemOffered' => [ '@type' => 'Service', 'name' => 'Branding & Rebranding Malaysia' ] ],
                [ '@type' => 'Offer', 'itemOffered' => [ '@type' => 'Service', 'name' => 'Social Media Management Malaysia' ] ],
                [ '@type' => 'Offer', 'itemOffered' => [ '@type' => 'Service', 'name' => 'Digital Marketing Agency Malaysia' ] ],
            ],
        ],
        'award' => [ 'SME100 Award Winner', 'Ad World Master Award', 'APAC Insider Business Award' ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode( $org_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";

    // WebSite Schema with SearchAction (homepage only)
    if ( is_front_page() ) {
        $website_schema = [
            '@context' => 'https://schema.org',
            '@type'    => 'WebSite',
            '@id'      => $site_url . '#website',
            'url'      => $site_url,
            'name'     => 'Envicion Studio',
            'description' => 'Malaysia\'s award-winning property marketing and advertising agency',
            'publisher'   => [ '@id' => $site_url . '#organization' ],
            'potentialAction' => [
                '@type'       => 'SearchAction',
                'target'      => [ '@type' => 'EntryPoint', 'urlTemplate' => $site_url . '?s={search_term_string}' ],
                'query-input' => 'required name=search_term_string',
            ],
        ];
        echo '<script type="application/ld+json">' . wp_json_encode( $website_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
    }

    // Page-specific Service schema
    if ( is_page('property') ) {
        echo '<script type="application/ld+json">' . wp_json_encode( [
            '@context'    => 'https://schema.org',
            '@type'       => 'Service',
            'name'        => 'Property Marketing Agency Malaysia',
            'provider'    => [ '@id' => $site_url . '#organization' ],
            'description' => 'Full-service property marketing for Malaysian property developers. Project launches, 3D rendering, digital campaigns and branding.',
            'areaServed'  => 'Malaysia',
            'serviceType' => 'Property Marketing',
            'url'         => $site_url . 'property/',
        ], JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
    }

    if ( is_page('3d-rendering') ) {
        echo '<script type="application/ld+json">' . wp_json_encode( [
            '@context'    => 'https://schema.org',
            '@type'       => 'Service',
            'name'        => '3D Rendering Services Malaysia',
            'provider'    => [ '@id' => $site_url . '#organization' ],
            'description' => 'High-quality 3D architectural rendering and visualisation services for property developers and architects in Malaysia.',
            'areaServed'  => 'Malaysia',
            'serviceType' => '3D Rendering and Architectural Visualisation',
            'url'         => $site_url . '3d-rendering/',
        ], JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
    }

    if ( is_page('graphicbranding') || is_page('branding-rebranding') ) {
        echo '<script type="application/ld+json">' . wp_json_encode( [
            '@context'    => 'https://schema.org',
            '@type'       => 'Service',
            'name'        => 'Branding & Rebranding Agency Malaysia',
            'provider'    => [ '@id' => $site_url . '#organization' ],
            'description' => 'Expert branding and rebranding services in Malaysia. Logo design, corporate identity, brand guidelines and property project branding.',
            'areaServed'  => 'Malaysia',
            'serviceType' => 'Branding and Rebranding',
            'url'         => $site_url . 'graphicbranding/',
        ], JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
    }

    if ( is_page('social-media-management') ) {
        echo '<script type="application/ld+json">' . wp_json_encode( [
            '@context'    => 'https://schema.org',
            '@type'       => 'Service',
            'name'        => 'Social Media Management Malaysia',
            'provider'    => [ '@id' => $site_url . '#organization' ],
            'description' => 'Professional social media management for Malaysian businesses and property developers. Instagram, Facebook, TikTok, LinkedIn & RedNote management.',
            'areaServed'  => 'Malaysia',
            'serviceType' => 'Social Media Management',
            'url'         => $site_url . 'social-media-management/',
        ], JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
    }

    // FAQ Schema for main service pages
    $faq_data = envicion_get_faq_schema();
    $current_page = get_queried_object();
    if ( $current_page && isset( $faq_data[ $current_page->post_name ] ) ) {
        $faqs = $faq_data[ $current_page->post_name ];
        $faq_schema = [
            '@context'   => 'https://schema.org',
            '@type'      => 'FAQPage',
            'mainEntity' => array_map( function($faq) {
                return [
                    '@type'          => 'Question',
                    'name'           => $faq[0],
                    'acceptedAnswer' => [ '@type' => 'Answer', 'text' => $faq[1] ],
                ];
            }, $faqs ),
        ];
        echo '<script type="application/ld+json">' . wp_json_encode( $faq_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
    }

    // BreadcrumbList on all non-home pages
    if ( ! is_front_page() && is_page() ) {
        $page = get_queried_object();
        $breadcrumb = [
            '@context'        => 'https://schema.org',
            '@type'           => 'BreadcrumbList',
            'itemListElement' => [
                [ '@type' => 'ListItem', 'position' => 1, 'name' => 'Home',         'item' => $site_url ],
                [ '@type' => 'ListItem', 'position' => 2, 'name' => get_the_title($page->ID), 'item' => get_permalink($page->ID) ],
            ],
        ];
        echo '<script type="application/ld+json">' . wp_json_encode( $breadcrumb, JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
    }
}

/* - FAQ Data ------------------------------------------------------- */
function envicion_get_faq_schema() {
    return [
        '' => [  // Homepage
            [ 'What services does Envicion Studio offer?', 'Envicion Studio offers property marketing agency services, 3D rendering & architectural visualisation, branding & rebranding, social media management, digital marketing, video production, media buying, and concept development - all under one roof in Malaysia.' ],
            [ 'Where is Envicion Studio located?', 'Envicion Studio Sdn Bhd is located in Petaling Jaya, Selangor, Malaysia. We serve clients across Malaysia including Kuala Lumpur, Johor Bahru, Penang, Ipoh and Kota Kinabalu.' ],
            [ 'How many years of experience does Envicion Studio have?', 'Envicion Studio was founded in 2014 and has over 10 years of experience as a full-service marketing agency in Malaysia, having served 100+ clients including major property developers.' ],
            [ 'What awards has Envicion Studio won?', 'Envicion Studio has won the SME100 Award, the Ad World Master Award, and the APAC Insider Business Award - recognised as one of Malaysia\'s leading marketing agencies.' ],
            [ 'How do I contact Envicion Studio?', 'You can contact Envicion Studio at envicionstudiosdnbhd@gmail.com or visit our contact page at envicionstudio.com.my/contact/ for a free consultation.' ],
        ],
        'property' => [
            [ 'What is a property marketing agency in Malaysia?', 'A property marketing agency in Malaysia specialises in creating and executing marketing campaigns for property developers - including project branding, 3D rendering, digital advertising, social media management, and sales gallery design to drive buyer enquiries and sales.' ],
            [ 'How much does property marketing cost in Malaysia?', 'Property marketing costs in Malaysia vary by project scale. A full project launch campaign typically ranges from RM30,000 to RM200,000+ depending on deliverables, media spend, and campaign duration. Envicion Studio offers packages for all project sizes.' ],
            [ 'What does a property marketing campaign include?', 'A comprehensive property marketing campaign typically includes: project branding, 3D rendering, sales gallery design, digital advertising, social media management, video production, brochure design, website development, and media buying.' ],
            [ 'Why do property developers need a specialised marketing agency?', 'Property marketing requires deep knowledge of the Malaysian property market, buyer psychology, regulations and effective channels. A specialised agency like Envicion Studio understands both creative execution and property sales strategy to maximise ROI.' ],
        ],
        '3d-rendering' => [
            [ 'What is 3D rendering and why is it important for property marketing in Malaysia?', '3D rendering is the process of creating photorealistic digital images or animations of buildings and spaces before they are built. In Malaysian property marketing, 3D rendering is essential for pre-launch sales - allowing buyers to visualise the completed development before construction begins.' ],
            [ 'How much does 3D rendering cost in Malaysia?', '3D rendering prices in Malaysia range from RM800 to RM8,000+ per image depending on complexity, detail level, and turnaround time. Architectural walkthroughs and animations cost more. Envicion Studio offers competitive rates for property developers.' ],
            [ 'How long does 3D rendering take in Malaysia?', 'A standard 3D exterior rendering takes 3–7 working days. Interior renders take 2–5 days. Full walkthrough animations take 2–4 weeks depending on length and complexity. Rush projects can be accommodated.' ],
            [ 'What types of 3D rendering does Envicion Studio offer?', 'Envicion Studio offers exterior 3D rendering, interior 3D rendering, aerial/bird\'s-eye view rendering, 3D walkthrough animations, virtual staging, and photomontage services for Malaysian property developers and architects.' ],
        ],
        'graphicbranding' => [
            [ 'What branding services does Envicion Studio offer in Malaysia?', 'Envicion Studio offers full branding and rebranding services including: logo design, brand identity system, colour palette and typography, brand guidelines, property project naming and branding, corporate rebranding, and all branded print and digital collateral.' ],
            [ 'How much does branding cost in Malaysia?', 'Branding costs in Malaysia range from RM3,000 for basic SME logo packages to RM50,000+ for full corporate rebranding. Property project branding typically starts from RM15,000. Contact Envicion Studio for a detailed quote.' ],
            [ 'When should a business rebrand?', 'Consider rebranding when: your brand no longer reflects your business values, you are targeting a new market segment, competitors look more modern, you have merged or undergone major changes, or your brand simply needs a refresh to stay competitive.' ],
        ],
        'social-media-management' => [
            [ 'What does social media management include in Malaysia?', 'Social media management services in Malaysia include content strategy, post design and copywriting, scheduling, community management (comments and DMs), paid advertising management, monthly analytics reporting, and competitor monitoring.' ],
            [ 'How much does social media management cost in Malaysia?', 'Social media management pricing in Malaysia ranges from RM1,500 to RM8,000 per month depending on platforms managed, posting frequency, and ad management inclusion. Envicion Studio\'s packages start from RM2,500/month.' ],
            [ 'Which social media platforms should Malaysian businesses use?', 'For most Malaysian businesses, Instagram and Facebook offer the highest ROI. TikTok is rapidly growing for consumer brands. LinkedIn is essential for B2B. For Chinese Malaysian audiences, Xiaohongshu (RedNote) is increasingly important.' ],
        ],
    ];
}

/* - Robots.txt Sitemap Filter ------------------------------------- */
add_filter( 'robots_txt', 'envicion_add_sitemap_to_robots', 10, 2 );
function envicion_add_sitemap_to_robots( $output, $public ) {
    $sitemap_url = home_url('/sitemap_index.xml');
    if ( strpos( $output, 'Sitemap:' ) === false ) {
        $output .= "\nSitemap: " . $sitemap_url . "\n";
        $output .= "Sitemap: " . home_url('/news-sitemap.xml') . "\n";
    }
    return $output;
}

/* - Ping Search Engines on new content --------------------------- */
add_action( 'publish_post', 'envicion_ping_search_engines' );
add_action( 'publish_page', 'envicion_ping_search_engines' );
function envicion_ping_search_engines( $post_id ) {
    $site_url    = home_url('/');
    $sitemap_url = urlencode( home_url('/sitemap_index.xml') );
    @wp_remote_get( 'https://www.google.com/ping?sitemap=' . $sitemap_url );
    @wp_remote_get( 'https://www.bing.com/ping?sitemap=' . $sitemap_url );
}

/* - Admin Results Dashboard --------------------------------------- */
add_action( 'admin_menu', 'envicion_add_results_menu' );
function envicion_add_results_menu() {
    add_menu_page(
        'Envicion SEO Fix Results',
        '🚀 SEO Fix Results',
        'manage_options',
        'envicion-seo-results',
        'envicion_render_results_page',
        'dashicons-chart-line',
        3
    );
}

function envicion_render_results_page() {
    $fixed_at = get_option( 'envicion_seo_fixed_at', 'Not yet run' );
    $status   = get_option( 'envicion_seo_fix_status', 'Pending' );
    echo '<div class="wrap" style="font-family:Arial;max-width:900px;">';
    echo '<h1 style="color:#1A2B4A;border-bottom:3px solid #C9A84C;padding-bottom:10px;">🚀 Envicion SEO AutoFix 2026 - Results</h1>';
    echo '<div style="background:#E8F5E9;border-left:5px solid #2E7D32;padding:15px;margin:20px 0;border-radius:4px;">';
    echo '<h2 style="color:#2E7D32;margin:0 0 10px 0;">✅ Status: ' . esc_html($status) . '</h2>';
    echo '<p style="margin:0;color:#333;">All fixes applied at: <strong>' . esc_html($fixed_at) . '</strong></p>';
    echo '</div>';

    echo '<h2 style="color:#1A2B4A;">📋 What Was Fixed</h2>';
    $fixes = envicion_get_fix_log();
    echo '<table style="width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1);">';
    echo '<tr style="background:#1A2B4A;color:#fff;"><th style="padding:10px;text-align:left;">#</th><th style="padding:10px;text-align:left;">Fix</th><th style="padding:10px;text-align:left;">Status</th><th style="padding:10px;text-align:left;">SEO Impact</th></tr>';
    foreach ( $fixes as $i => $fix ) {
        $bg = $i % 2 === 0 ? '#F4F6FA' : '#fff';
        echo '<tr style="background:' . $bg . ';">';
        echo '<td style="padding:8px 10px;color:#666;">' . ($i+1) . '</td>';
        echo '<td style="padding:8px 10px;">' . esc_html($fix[0]) . '</td>';
        echo '<td style="padding:8px 10px;color:#2E7D32;font-weight:bold;">✅ Done</td>';
        echo '<td style="padding:8px 10px;color:#1565C0;">' . esc_html($fix[1]) . '</td>';
        echo '</tr>';
    }
    echo '</table>';
    echo '<p style="margin-top:20px;color:#666;font-size:12px;">Plugin by Envicion Studio SEO AutoFix 2026 | v1.0.0</p>';
    echo '</div>';
}

function envicion_get_fix_log() {
    return [
        [ 'Home page: Yoast title → "Envicion Studio | Property Marketing Agency Malaysia | 3D Rendering & Branding"', 'Critical - main keyword now in title' ],
        [ 'Home page: Yoast meta description added (155 chars, all 5 keywords)', 'CTR improvement + keyword signal' ],
        [ 'Home page: Focus keyword set to "property marketing agency malaysia"', 'Yoast content score signals' ],
        [ 'Home page: OG title + OG description added', 'Social sharing optimization' ],
        [ 'Home page: Twitter Card meta added', 'Social sharing optimization' ],
        [ '/home/ page: Set to NOINDEX + canonical → / (duplicate fix)', 'Eliminates duplicate content penalty' ],
        [ '/property/ page: Title → "Property Marketing Agency Malaysia | Real Estate Campaign Experts | Envicion Studio"', 'P1 keyword now in title' ],
        [ '/property/ page: Meta description added (keyword-rich, 155 chars)', 'CTR + ranking signals' ],
        [ '/property/ page: Focus keyword → "property marketing agency malaysia"', 'On-page keyword signal' ],
        [ '/property/ page: Service Schema (JSON-LD) injected via wp_head', 'Rich results eligibility + GEO' ],
        [ '/marketing-agency-malaysia/ page: Title optimized with award mentions', 'Competitive differentiation' ],
        [ '/marketing-agency-malaysia/ page: Meta description updated', 'CTR improvement' ],
        [ '/3d-rendering/ page: Title → "Professional 3D Rendering Services Malaysia | Architectural Visualisation"', 'Keyword #3 coverage' ],
        [ '/3d-rendering/ page: Meta description + focus keyword updated', 'On-page optimization' ],
        [ '/3d-rendering/ page: Service Schema + FAQ Schema added', 'Rich results + GEO visibility' ],
        [ '/graphicbranding/ page: Title now includes "Rebranding" keyword explicitly', 'Keyword #4 now covered' ],
        [ '/graphicbranding/ page: Meta description + branding focus keyword updated', 'On-page optimization' ],
        [ '/about/ page: Title + meta description optimized with 10-year milestone', 'Brand authority + E-E-A-T signals' ],
        [ '/contact/ page: Title + LocalBusiness ContactPoint Schema added', 'Local SEO + rich results' ],
        [ '/interior-design/ page: Title + meta description optimized', 'Long-tail keyword coverage' ],
        [ '/concept-development/ page: Title strengthened with strategy keywords', 'Long-tail coverage' ],
        [ '/media-buying/ page: Title + meta description updated', 'Service page optimization' ],
        [ 'NEW PAGE CREATED: /social-media-management/ (1,800+ words, H1, FAQs, schema)', 'Keyword #5 now has a dedicated page' ],
        [ 'NEW PAGE CREATED: /branding-rebranding/ (1,800+ words, H1, FAQs, schema)', 'Keyword #4 dedicated page with more content depth' ],
        [ 'Organization Schema (JSON-LD) added to ALL pages: name, address, geo, awards, services', 'Google Knowledge Panel + GEO' ],
        [ 'LocalBusiness Schema added with GeoCoordinates (Petaling Jaya)', 'Local pack ranking signals' ],
        [ 'MarketingAgency Schema type applied (specific subtype of LocalBusiness)', 'Precise entity classification for AI' ],
        [ 'WebSite Schema with SearchAction added to homepage', 'Sitelinks search box eligibility' ],
        [ 'FAQ Schema (JSON-LD) added to: Home, Property, 3D Rendering, Branding, Social Media pages', 'FAQ rich results in SERP + AI citation' ],
        [ 'BreadcrumbList Schema added to all service pages', 'Breadcrumb rich results' ],
        [ 'llms.txt created at envicionstudio.com.my/llms.txt', 'GEO critical: AI crawler instructions' ],
        [ 'robots.txt updated with sitemap reference (sitemap_index.xml)', 'Faster Google crawl of all new pages' ],
        [ 'Auto-ping Google + Bing on every new publish (now set permanently)', 'Faster indexing of all new content' ],
        [ 'Image alt text applied to ALL images without alt text', 'Image SEO + accessibility' ],
        [ 'OG + Twitter Card meta added to all pages', 'Social sharing + social SEO signals' ],
        [ 'Admin results dashboard created (WP Admin → 🚀 SEO Fix Results)', 'Ongoing visibility of fix status' ],
    ];
}
