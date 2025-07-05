<?php




add_action('wp_ajax_load_gender_content', 'handle_gender_content_request');
add_action('wp_ajax_nopriv_load_gender_content', 'handle_gender_content_request');

function handle_gender_content_request() {
    check_ajax_referer('gender_tabs_nonce', 'nonce');

    $gender = sanitize_text_field($_POST['gender'] ?? '');
    $valid_genders = ['women', 'men', 'kids'];
    
    if (!in_array($gender, $valid_genders)) {
        wp_send_json_error('Invalid gender parameter');
    }

    // Get just the content part
    ob_start();
    get_template_part('template-parts/content', $gender);
    $content = ob_get_clean();

    wp_send_json_success([
        'content' => $content,
        'new_nonce' => wp_create_nonce('gender_tabs_nonce')
    ]);
}







add_filter( 'woocommerce_get_price_html', 'custom_price_message_based_on_url' );

function custom_price_message_based_on_url( $price ) {
    // Check if the current page is a WooCommerce product page
    if ( is_product() ) {
        // Get the product URL
        $product_url = get_permalink();
        
        // Check if the product URL contains '/product/' (indicating a product page)
        if ( strpos( $product_url, '/product/' ) !== false ) {
            // Apply the custom price message
            $custom_text = '<p><strong>(Inclusive of All Taxes + Free Shipping)</strong></p>';
            return $price . $custom_text;
        }
    }
    
    // If not a product page or URL does not contain '/product/', return the original price
    return $price;
}


function add_mrp_before_price($price, $product) {
    if (is_product() || is_singular('product')) {
        // Adding inline CSS to make the font size smaller for the M.R.P: label
        $price = '<span class="mrp-label" style="font-size: 20px;">MRP: </span>' . $price;
    }
    return $price;
}
add_filter('woocommerce_get_price_html', 'add_mrp_before_price', 10, 2);


add_action('wp_enqueue_scripts', 'theme_enqueue_styles', 998);
function theme_enqueue_styles() {
    $prefix = function_exists('elessi_prefix_theme') ? elessi_prefix_theme() : 'elessi';
    wp_enqueue_style($prefix . '-style', get_template_directory_uri() . '/style.css');
    wp_enqueue_style($prefix . '-child-style', get_stylesheet_uri());
}
