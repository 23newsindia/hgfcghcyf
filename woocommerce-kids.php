<?php
/**
 * Template Name: WooCommerce Kids' Page
 */
get_header();
?>

<div class="woocommerce-gender-page kids-page">
    <!-- Slider Shortcode -->
    <div class="gender-slider">
        <?php echo do_shortcode('[category_slider]'); ?>
    </div>
    
    <!-- Product Content -->
    <div class="gender-content">
        <?php echo do_shortcode('[products limit="12" columns="4" category="kids"]'); ?>
    </div>
</div>

<?php get_footer(); ?>
