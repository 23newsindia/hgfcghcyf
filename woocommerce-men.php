<?php
/**
* Template Name: WooCommerce Men's Page
*/
get_header();
?>

<div class="woocommerce-gender-page men-page">
    <?php
    // Directly include the template part used for AJAX
    get_template_part('template-parts/content', 'men');
    ?>
</div>

<?php get_footer(); ?>
