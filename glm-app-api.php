<?php
/**
 * Plugin Name: GLM Designer App API
 * Description: REST API endpoints for the GLM Designer mobile app.
 * Version:     2.0.0
 * Author:      Richard LAAK — Golf Life Metals LLC
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'rest_api_init', function () {

    register_rest_route( 'glm/v1', '/markers', [
        'methods'             => 'GET',
        'callback'            => 'glm_api_get_markers',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route( 'glm/v1', '/my-orders', [
        'methods'             => 'GET',
        'callback'            => 'glm_api_get_my_orders',
        'permission_callback' => 'glm_api_is_authenticated',
    ]);

    register_rest_route( 'glm/v1', '/register', [
        'methods'             => 'POST',
        'callback'            => 'glm_api_register',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route( 'glm/v1', '/create-payment-intent', [
        'methods'             => 'POST',
        'callback'            => 'glm_api_create_payment_intent',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route( 'glm/v1', '/create-order', [
        'methods'             => 'POST',
        'callback'            => 'glm_api_create_order',
        'permission_callback' => '__return_true',
    ]);

});

// ── Auth ──────────────────────────────────────────────────────────────────────
function glm_api_is_authenticated() {
    return is_user_logged_in() || glm_api_validate_jwt();
}

function glm_api_validate_jwt() {
    $auth = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    if ( ! $auth && function_exists( 'getallheaders' ) ) {
        $headers = getallheaders();
        $auth    = $headers['Authorization'] ?? '';
    }
    if ( ! $auth ) return false;
    $token = str_replace( 'Bearer ', '', $auth );
    if ( function_exists( 'jwt_auth_get_token_by_user_id' ) ) return true;
    return false;
}

// ── GET markers ───────────────────────────────────────────────────────────────
function glm_api_get_markers() {
    $gallery = get_option( 'mgl_cm_gallery', [] );
    if ( ! is_array( $gallery ) ) return rest_ensure_response( [] );
    $out = [];
    foreach ( $gallery as $card ) {
        if ( empty( $card['img'] ) ) continue;
        $out[] = [
            'name'           => sanitize_text_field( $card['name']  ?? '' ),
            'tag'            => sanitize_text_field( $card['tag']   ?? '' ),
            'badge'          => sanitize_text_field( $card['badge'] ?? '' ),
            'img'            => esc_url_raw( $card['img'] ),
            'price'          => (float) ( $card['price'] ?? 94 ),
            'remake_enabled' => isset( $card['remake_enabled'] ) ? (bool) $card['remake_enabled'] : true,
        ];
    }
    return rest_ensure_response( $out );
}

// ── GET my orders ─────────────────────────────────────────────────────────────
function glm_api_get_my_orders( WP_REST_Request $request ) {
    $user_id = glm_api_get_user_from_request( $request );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Not authenticated', [ 'status' => 401 ] );
    if ( ! function_exists( 'wc_get_orders' ) ) return rest_ensure_response( [] );
    // Get user email for fallback search (catches orders placed before customer_id fix)
    $user_obj   = get_user_by( 'id', $user_id );
    $user_email = $user_obj ? $user_obj->user_email : '';

    // Search by customer_id first, then merge with email search for old orders
    $orders_by_id    = wc_get_orders([ 'customer_id' => $user_id, 'limit' => 20, 'orderby' => 'date', 'order' => 'DESC' ]);
    $orders_by_email = $user_email ? wc_get_orders([ 'billing_email' => $user_email, 'limit' => 20, 'orderby' => 'date', 'order' => 'DESC' ]) : [];

    // Merge and deduplicate
    $seen = [];
    $merged = [];
    foreach ( array_merge( $orders_by_id, $orders_by_email ) as $o ) {
        if ( ! isset( $seen[ $o->get_id() ] ) ) {
            $seen[ $o->get_id() ] = true;
            $merged[] = $o;
        }
    }
    usort( $merged, function($a, $b) { return $b->get_date_created()->getTimestamp() - $a->get_date_created()->getTimestamp(); });
    $wc_orders = array_slice( $merged, 0, 20 );

    $out = [];
    foreach ( $wc_orders as $order ) {
        $image = '';
        foreach ( $order->get_items() as $item ) {
            $pid  = $item->get_product_id();
            $img  = get_post_meta( $pid, '_glm_design_img_a', true );
            if ( $img ) { $image = $img; break; }
            $thumb = get_the_post_thumbnail_url( $pid, 'thumbnail' );
            if ( $thumb ) { $image = $thumb; break; }
        }
        $out[] = [
            'id'              => $order->get_id(),
            'name'            => 'Custom Copper Marker — GLM',
            'status'          => $order->get_status(),
            'total'           => number_format( (float) $order->get_total(), 2 ),
            'date'            => $order->get_date_created() ? $order->get_date_created()->date( 'M j, Y' ) : '',
            'image'           => $order->get_meta('_glm_design_image') ?: $image,
            'design_image_b'  => $order->get_meta('_glm_design_image_b'),
            'finish'          => $order->get_meta('_glm_finish'),
            'sides'           => $order->get_meta('_glm_sides'),
            'color_choice'    => $order->get_meta('_glm_color_choice'),
            'tracking_number' => $order->get_meta('_glm_tracking'),
            'carrier'         => $order->get_meta('_glm_carrier'),
            'finished_front'  => $order->get_meta('_glm_finished_front'),
            'finished_back'   => $order->get_meta('_glm_finished_back'),
        ];
    }
    return rest_ensure_response( $out );
}

// ── POST register ─────────────────────────────────────────────────────────────
function glm_api_register( WP_REST_Request $request ) {
    $name     = sanitize_text_field( $request->get_param( 'name' )     ?? '' );
    $email    = sanitize_email(      $request->get_param( 'email' )    ?? '' );
    $password = $request->get_param( 'password' ) ?? '';
    if ( ! $name || ! $email || ! $password ) return new WP_Error( 'missing_fields', 'Name, email and password required', [ 'status' => 400 ] );
    if ( ! is_email( $email ) ) return new WP_Error( 'invalid_email', 'Invalid email', [ 'status' => 400 ] );
    if ( email_exists( $email ) ) return new WP_Error( 'email_exists', 'Email already exists', [ 'status' => 400 ] );
    $username = sanitize_user( strtolower( str_replace( ' ', '.', $name ) ) . '.' . substr( md5( $email ), 0, 4 ) );
    $user_id  = wp_create_user( $username, $password, $email );
    if ( is_wp_error( $user_id ) ) return new WP_Error( 'register_failed', $user_id->get_error_message(), [ 'status' => 400 ] );
    wp_update_user([ 'ID' => $user_id, 'display_name' => $name, 'first_name' => explode( ' ', $name )[0] ]);
    $token = '';
    if ( function_exists( 'jwt_auth_generate_token' ) ) $token = jwt_auth_generate_token( get_user_by( 'id', $user_id ) );
    $user = get_user_by('id', $user_id);
    $role = !empty($user->roles) ? $user->roles[0] : 'customer';
    return rest_ensure_response([ 'token' => $token, 'user_display_name' => $name, 'user_email' => $email, 'user_role' => $role, 'message' => 'Account created' ]);
}

// ── POST create-payment-intent ────────────────────────────────────────────────
function glm_api_create_payment_intent( WP_REST_Request $request ) {
    $amount      = (int) ( $request->get_param('amount') ?? 11500 );
    $currency    = sanitize_text_field( $request->get_param('currency') ?? 'usd' );
    $secret_key  = 'YOUR_STRIPE_SECRET_KEY';

    $response = wp_remote_post( 'https://api.stripe.com/v1/payment_intents', [
        'headers' => [
            'Authorization' => 'Bearer ' . $secret_key,
            'Content-Type'  => 'application/x-www-form-urlencoded',
        ],
        'body' => [
            'amount'                    => $amount,
            'currency'                  => $currency,
            'description'               => 'Custom Copper Golf Marker — GLM',
            'automatic_payment_methods' => [ 'enabled' => 'true' ],
        ],
        'timeout' => 30,
    ]);

    if ( is_wp_error( $response ) ) return new WP_Error( 'stripe_error', $response->get_error_message(), [ 'status' => 500 ] );
    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( isset( $body['error'] ) ) return new WP_Error( 'stripe_error', $body['error']['message'], [ 'status' => 400 ] );

    return rest_ensure_response([
        'client_secret'     => $body['client_secret'],
        'payment_intent_id' => $body['id'],
        'amount'            => $body['amount'],
        'currency'          => $body['currency'],
    ]);
}

// ── POST create-order ─────────────────────────────────────────────────────────
function glm_api_create_order( WP_REST_Request $request ) {
    $first_name        = sanitize_text_field( $request->get_param('first_name') ?? '' );
    $last_name         = sanitize_text_field( $request->get_param('last_name')  ?? '' );
    $email             = sanitize_email(      $request->get_param('email')       ?? '' );
    $address           = sanitize_text_field( $request->get_param('address')    ?? '' );
    $city              = sanitize_text_field( $request->get_param('city')        ?? '' );
    $zip               = sanitize_text_field( $request->get_param('zip')         ?? '' );
    $state             = sanitize_text_field( $request->get_param('state')       ?? '' );
    $country           = sanitize_text_field( $request->get_param('country')    ?? 'US' );
    $phone             = sanitize_text_field( $request->get_param('phone')       ?? '' );
    $payment_intent_id = sanitize_text_field( $request->get_param('payment_intent_id') ?? '' );
    $amount            = (float) ( $request->get_param('amount') ?? 115 );
    $subtotal          = (float) ( $request->get_param('subtotal') ?? $amount );
    $shipping_amt      = (float) ( $request->get_param('shipping') ?? 0 );
    $tax_amt           = (float) ( $request->get_param('tax')      ?? 0 );
    $discount_amt      = (float) ( $request->get_param('discount') ?? 0 );
    $discount_code     = sanitize_text_field( $request->get_param('discount_code') ?? '' );
    $finish            = sanitize_text_field( $request->get_param('finish')      ?? '' );
    $sides             = sanitize_text_field( $request->get_param('sides')       ?? '' );
    $color_choice      = sanitize_text_field( $request->get_param('color_choice') ?? '' );
    $design_image      = $request->get_param('design_image') ?? '';
    $design_image_b    = $request->get_param('design_image_b') ?? '';

    // Create WooCommerce order
    // Get logged-in user ID so order shows in their order history
    $current_user_id = 0;
    $auth_header = $request->get_header('Authorization');
    if ( $auth_header && strpos( $auth_header, 'Bearer ' ) === 0 ) {
        $token = str_replace( 'Bearer ', '', $auth_header );
        $decoded = null;
        if ( function_exists( 'jwt_auth_decode_token' ) ) {
            $decoded = jwt_auth_decode_token( $token );
        }
        if ( $decoded && isset( $decoded->data->user->id ) ) {
            $current_user_id = (int) $decoded->data->user->id;
        }
    }
    if ( ! $current_user_id ) {
        $current_user_id = get_current_user_id();
    }
    $order = wc_create_order( [ 'customer_id' => $current_user_id ] );

    $item = new WC_Order_Item_Product();
    $item->set_name( 'Custom Copper Golf Marker — GLM' );
    $item->set_quantity( 1 );
    $item->set_subtotal( $amount );
    $item->set_total( $amount );
    $order->add_item( $item );

    $order->set_billing_first_name( $first_name );
    $order->set_billing_last_name( $last_name );
    $order->set_billing_email( $email );
    $order->set_billing_phone( $phone );
    $order->set_billing_address_1( $address );
    $order->set_billing_city( $city );
    $order->set_billing_postcode( $zip );
    $order->set_billing_country( $country );
    $order->set_shipping_first_name( $first_name );
    $order->set_shipping_last_name( $last_name );
    $order->set_shipping_address_1( $address );
    $order->set_shipping_city( $city );
    $order->set_shipping_postcode( $zip );
    $order->set_shipping_country( $country );
    $order->set_payment_method( 'stripe' );
    $order->set_payment_method_title( 'Stripe (GLM App)' );
    $order->set_total( $amount );

    if ( $payment_intent_id ) {
        $order->add_order_note( 'Stripe Payment Intent: ' . $payment_intent_id );
        update_post_meta( $order->get_id(), '_stripe_intent_id', $payment_intent_id );
    }

    // Save design image as order meta
    if ( $design_image ) {
        update_post_meta( $order->get_id(), '_glm_app_design_image', $design_image );
    }
    if ( $design_image_b ) {
        update_post_meta( $order->get_id(), '_glm_app_design_image_b', $design_image_b );
    }
    if ( $finish )       update_post_meta( $order->get_id(), '_glm_finish_name', $finish );
    if ( $sides )        update_post_meta( $order->get_id(), '_glm_sides', $sides );
    if ( $color_choice ) update_post_meta( $order->get_id(), '_glm_color_choice', $color_choice );
    if ( $discount_code ) update_post_meta( $order->get_id(), '_glm_discount_code', $discount_code );
    if ( $shipping_amt > 0 ) update_post_meta( $order->get_id(), '_glm_shipping', $shipping_amt );
    if ( $tax_amt > 0 )  update_post_meta( $order->get_id(), '_glm_tax', $tax_amt );

    $order->update_status( 'processing', 'Order placed via GLM App.' );
    $order->save();

    // ── Email design to studio ────────────────────────────────────────────────
    $studio_emails = [ 'orders@golflifemetals.com', 'jon@golflifemetals.com' ];
    $order_id      = $order->get_id();
    $order_num     = $order->get_order_number();

    $subject = "New GLM App Order #{$order_num} — {$first_name} {$last_name}";

    $img_html = '';
    if ( $design_image && strpos( $design_image, 'data:image' ) === 0 ) {
        $img_html .= "<p><strong>Side A:</strong></p><img src='{$design_image}' style='max-width:380px;border-radius:12px;border:2px solid #B87333;display:block;margin-bottom:12px;' />";
    }
    if ( $design_image_b && strpos( $design_image_b, 'data:image' ) === 0 ) {
        $img_html .= "<p><strong>Side B:</strong></p><img src='{$design_image_b}' style='max-width:380px;border-radius:12px;border:2px solid #B87333;display:block;' />";
    }

    // Build order details rows
    $details_html = '';
    if ( $finish )       $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Finish</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#B87333;font-weight:bold;'>{$finish}</td></tr>";
    if ( $sides )        $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Sides</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>{$sides}</td></tr>";
    if ( $color_choice ) $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Colors</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>{$color_choice}</td></tr>";
    if ( $discount_code ) $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Discount</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#4CAF72;'>-\${$discount_amt} ({$discount_code})</td></tr>";
    if ( $shipping_amt > 0 ) $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Shipping</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>\${$shipping_amt}</td></tr>";
    if ( $tax_amt > 0 )  $details_html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Tax</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>\${$tax_amt}</td></tr>";

    $body = "
    <html><body style='font-family:sans-serif;background:#111;color:#F0EDE8;padding:32px;'>
    <div style='max-width:600px;margin:0 auto;background:#1A1A1A;border-radius:16px;padding:32px;border:1px solid #2A2A2A;'>
      <img src='https://aidemo.glmgolf.com/wp-content/uploads/2026/05/glm-logo.png' style='height:60px;margin-bottom:24px;' />
      <h1 style='color:#B87333;margin-bottom:4px;'>New Order #{$order_num}</h1>
      <p style='color:#888;margin-bottom:24px;'>Placed via GLM Designer App</p>

      {$img_html}

      <table style='width:100%;border-collapse:collapse;margin:24px 0;'>
        <tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Customer</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;font-weight:bold;'>{$first_name} {$last_name}</td></tr>
        <tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Email</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>{$email}</td></tr>
        <tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Phone</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>{$phone}</td></tr>
        <tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Shipping</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#F0EDE8;'>{$address}, {$city}, {$state} {$zip}, {$country}</td></tr>
        {$details_html}
        <tr><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#888;'>Total</td><td style='padding:10px 0;border-bottom:1px solid #2A2A2A;color:#B87333;font-weight:bold;font-size:18px;'>\${$amount} USD</td></tr>
        <tr><td style='padding:10px 0;color:#888;'>Payment</td><td style='padding:10px 0;color:#4CAF72;font-weight:bold;'>PAID — Stripe ({$payment_intent_id})</td></tr>
      </table>

      <a href='https://aidemo.glmgolf.com/wp-admin/post.php?post={$order_id}&action=edit' style='display:inline-block;background:#B87333;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;'>View Order in WP Admin</a>
    </div></body></html>";

    $headers = [ 'Content-Type: text/html; charset=UTF-8', 'From: GLM App <noreply@golflifemetals.com>' ];

    foreach ( $studio_emails as $to ) {
        wp_mail( $to, $subject, $body, $headers );
    }

    // Also send confirmation to customer
    $design_details_html = '';
    if ( $finish || $sides || $color_choice ) {
        $design_details_html = "<table style='width:100%;border-collapse:collapse;margin:16px 0;background:#1E1E1E;border-radius:10px;overflow:hidden;'>";
        if ($finish)       $design_details_html .= "<tr><td style='padding:10px 14px;color:#888;'>Finish</td><td style='padding:10px 14px;color:#B87333;font-weight:bold;'>{$finish}</td></tr>";
        if ($sides)        $design_details_html .= "<tr><td style='padding:10px 14px;color:#888;'>Sides</td><td style='padding:10px 14px;color:#F0EDE8;'>{$sides}</td></tr>";
        if ($color_choice) $design_details_html .= "<tr><td style='padding:10px 14px;color:#888;'>Colors</td><td style='padding:10px 14px;color:#F0EDE8;'>{$color_choice}</td></tr>";
        $design_details_html .= "</table>";
    }

    $customer_img_html = '';
    if ( $design_image && strpos( $design_image, 'data:image' ) === 0 ) {
        $customer_img_html .= "<p style='color:#888;font-size:12px;margin-bottom:6px;'>SIDE A</p><img src='{$design_image}' style='max-width:300px;border-radius:12px;border:2px solid #B87333;display:block;margin-bottom:12px;' />";
    }
    if ( $design_image_b && strpos( $design_image_b, 'data:image' ) === 0 ) {
        $customer_img_html .= "<p style='color:#888;font-size:12px;margin-bottom:6px;'>SIDE B</p><img src='{$design_image_b}' style='max-width:300px;border-radius:12px;border:2px solid #B87333;display:block;' />";
    }

    $customer_body = "
    <html><body style='font-family:sans-serif;background:#0D0D0D;color:#F0EDE8;padding:32px;'>
    <div style='max-width:600px;margin:0 auto;background:#1A1A1A;border-radius:16px;padding:32px;border:1px solid #2A2A2A;'>
      <img src='https://aidemo.glmgolf.com/wp-content/uploads/2026/05/glm-logo.png' style='height:60px;margin-bottom:24px;' />
      <h1 style='color:#B87333;margin-bottom:8px;'>Your Order is Confirmed! 🎉</h1>
      <p style='color:#BFB8AF;margin-bottom:24px;'>Hi {$first_name}, thank you so much for your order. Order #{$order_num}.</p>

      {$customer_img_html}
      {$design_details_html}

      <div style='background:#1E2E24;border-radius:12px;padding:20px;margin:24px 0;border-left:3px solid #B87333;'>
        <p style='color:#B87333;font-weight:bold;margin:0 0 12px;'>✉️ A note from Jon</p>
        <p style='color:#BFB8AF;font-size:14px;line-height:22px;margin:0;'>
          Thank you so much for your order! I personally review every design and handcraft each marker with care. Your custom copper marker will be made to last a lifetime on the green.<br/><br/>
          Once confirmed, I'll get started right away. You'll receive tracking info once it ships within 5–7 business days.<br/><br/>
          If you have any questions, just reply to this email — I read every one.<br/><br/>
          <em>— Jon, Golf Life Metals 🏌️‍♂️</em>
        </p>
      </div>

      <table style='width:100%;border-collapse:collapse;margin:0 0 24px;background:#1E1E1E;border-radius:10px;overflow:hidden;'>
        <tr><td style='padding:10px 14px;color:#888;'>Order</td><td style='padding:10px 14px;color:#F0EDE8;font-weight:bold;'>#{$order_num}</td></tr>
        <tr><td style='padding:10px 14px;color:#888;'>Product</td><td style='padding:10px 14px;color:#F0EDE8;'>Custom Copper Marker — GLM</td></tr>
        <tr><td style='padding:10px 14px;color:#888;'>Ships to</td><td style='padding:10px 14px;color:#F0EDE8;'>{$address}, {$city}, {$state} {$zip}, {$country}</td></tr>
        <tr><td style='padding:10px 14px;color:#888;'>Total Paid</td><td style='padding:10px 14px;color:#B87333;font-weight:bold;'>\${$amount} USD</td></tr>
      </table>

      <p style='color:#555;font-size:12px;text-align:center;'>Questions? Email <a href='mailto:orders@golflifemetals.com' style='color:#B87333;'>orders@golflifemetals.com</a></p>
    </div></body></html>";

    wp_mail( $email, "Your GLM Order #{$order_num} is Confirmed!", $customer_body, $headers );

    return rest_ensure_response([
        'order_id'     => $order_id,
        'order_number' => $order_num,
        'status'       => $order->get_status(),
        'total'        => $order->get_total(),
        'message'      => 'Order created and emails sent',
    ]);
}

// ── Validate coupon code ──────────────────────────────────────────────────────
add_action( 'rest_api_init', function () {
    register_rest_route( 'glm/v1', '/validate-coupon', [
        'methods'             => 'POST',
        'callback'            => 'glm_api_validate_coupon',
        'permission_callback' => '__return_true',
    ] );
} );

function glm_api_validate_coupon( WP_REST_Request $request ) {
    $code = strtolower( trim( sanitize_text_field( $request->get_param('code') ?? '' ) ) );

    if ( empty( $code ) ) {
        return rest_ensure_response([ 'valid' => false, 'message' => 'No code provided.' ]);
    }

    // Check WooCommerce coupon
    $coupon = new WC_Coupon( $code );

    if ( ! $coupon->get_id() ) {
        return rest_ensure_response([ 'valid' => false, 'message' => 'Invalid coupon code.' ]);
    }

    // Check if expired
    $expiry = $coupon->get_date_expires();
    if ( $expiry && $expiry->getTimestamp() < time() ) {
        return rest_ensure_response([ 'valid' => false, 'message' => 'This coupon has expired.' ]);
    }

    // Check usage limit
    $usage_limit = $coupon->get_usage_limit();
    $usage_count = $coupon->get_usage_count();
    if ( $usage_limit > 0 && $usage_count >= $usage_limit ) {
        return rest_ensure_response([ 'valid' => false, 'message' => 'This coupon has reached its usage limit.' ]);
    }

    $type    = $coupon->get_discount_type(); // percent or fixed_cart
    $amount  = (float) $coupon->get_amount();
    $pct     = 0;
    $label   = '';

    if ( $type === 'percent' ) {
        $pct   = $amount;
        $label = "{$pct}% discount applied!";
    } elseif ( $type === 'fixed_cart' ) {
        // Treat as approximate % for display — actual deduction done on total
        $pct   = $amount; // will be treated as fixed $ amount in app
        $label = "\${$amount} off your order!";
    }

    return rest_ensure_response([
        'valid'        => true,
        'discount_pct' => $pct,
        'type'         => $type,
        'label'        => $label,
        'code'         => strtoupper( $code ),
    ]);
}

// ── Helper ────────────────────────────────────────────────────────────────────
function glm_api_get_user_from_request( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( $user_id ) return $user_id;
    $auth = $request->get_header( 'authorization' );
    if ( ! $auth ) return 0;
    $token = str_replace( 'Bearer ', '', $auth );
    if ( ! $token ) return 0;
    $secret = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : '';
    if ( ! $secret ) return 0;
    try {
        $parts = explode( '.', $token );
        if ( count( $parts ) !== 3 ) return 0;
        $payload = json_decode( base64_decode( str_pad( strtr( $parts[1], '-_', '+/' ), strlen( $parts[1] ) % 4, '=', STR_PAD_RIGHT ) ), true );
        return isset( $payload['data']['user']['id'] ) ? (int) $payload['data']['user']['id'] : 0;
    } catch ( Exception $e ) { return 0; }
}

// ── STAMPS endpoints (added for GLM MobileApp v1) ────────────────────────────
add_action('rest_api_init', function() {

    // POST /wp-json/glm/v1/push-token — save device push token
    register_rest_route('glm/v1', '/push-token', [
        'methods'             => 'POST',
        'callback'            => 'glm_save_push_token',
        'permission_callback' => '__return_true',
    ]);

    // GET /wp-json/glm/v1/me — get current user info including role
    register_rest_route('glm/v1', '/me', [
        'methods'             => 'GET',
        'callback'            => 'glm_get_me',
        'permission_callback' => '__return_true',
    ]);

    // GET /wp-json/glm/v1/stamps — fetch all stamps for the native designer
    register_rest_route('glm/v1', '/stamps', [
        'methods'             => 'GET',
        'callback'            => 'glm_get_stamps',
        'permission_callback' => '__return_true',
    ]);

    // POST /wp-json/glm/v1/stamps — add a new stamp (admin only)
    register_rest_route('glm/v1', '/stamps', [
        'methods'             => 'POST',
        'callback'            => 'glm_add_stamp',
        'permission_callback' => 'glm_is_admin',
    ]);

    // PUT /wp-json/glm/v1/stamps/(?P<id>\d+) — edit a stamp (admin only)
    register_rest_route('glm/v1', '/stamps/(?P<id>\d+)', [
        'methods'             => 'POST',
        'callback'            => 'glm_update_stamp',
        'permission_callback' => 'glm_is_admin',
    ]);

    // DELETE /wp-json/glm/v1/stamps/(?P<id>\d+) — delete a stamp (admin only)
    register_rest_route('glm/v1', '/stamps/(?P<id>\d+)', [
        'methods'             => 'DELETE',
        'callback'            => 'glm_delete_stamp',
        'permission_callback' => 'glm_is_admin',
    ]);

    // GET /wp-json/glm/v1/admin/orders — all orders for admin panel
    register_rest_route('glm/v1', '/admin/orders', [
        'methods'             => 'GET',
        'callback'            => 'glm_admin_get_orders',
        'permission_callback' => 'glm_is_admin',
    ]);

    // POST /wp-json/glm/v1/admin/orders/(?P<id>\d+)/status
    register_rest_route('glm/v1', '/admin/orders/(?P<id>\d+)/status', [
        'methods'             => 'POST',
        'callback'            => 'glm_admin_update_status',
        'permission_callback' => 'glm_is_admin',
    ]);

    // POST /wp-json/glm/v1/admin/orders/(?P<id>\d+)/finished-marker
    register_rest_route('glm/v1', '/admin/orders/(?P<id>\d+)/finished-marker', [
        'methods'             => 'POST',
        'callback'            => 'glm_admin_upload_finished_marker',
        'permission_callback' => 'glm_is_admin',
    ]);

    // DELETE /wp-json/glm/v1/admin/orders/(?P<id>\d+)/finished-marker
    register_rest_route('glm/v1', '/admin/orders/(?P<id>\d+)/finished-marker', [
        'methods'             => 'DELETE',
        'callback'            => 'glm_admin_remove_finished_marker',
        'permission_callback' => 'glm_is_admin',
    ]);

    // POST /wp-json/glm/v1/admin/orders/(?P<id>\d+)/tracking
    register_rest_route('glm/v1', '/admin/orders/(?P<id>\d+)/tracking', [
        'methods'             => 'POST',
        'callback'            => 'glm_admin_update_tracking',
        'permission_callback' => 'glm_is_admin',
    ]);

    // POST /wp-json/glm/v1/admin/orders/(?P<id>\d+)/notify-customer
    register_rest_route('glm/v1', '/admin/orders/(?P<id>\d+)/notify-customer', [
        'methods'             => 'POST',
        'callback'            => 'glm_admin_notify_customer',
        'permission_callback' => 'glm_is_admin',
    ]);
});

function glm_save_push_token(WP_REST_Request $req) {
    $user  = wp_get_current_user();
    $token = sanitize_text_field($req->get_param('push_token'));
    if (!$token) return new WP_Error('missing', 'Token required', ['status' => 400]);
    // Save token against user or as a transient keyed by token
    if ($user && $user->ID) {
        update_user_meta($user->ID, '_glm_push_token', $token);
    }
    // Also store all tokens in a global option for admin sending
    $tokens = get_option('glm_push_tokens', []);
    $tokens[$token] = ['user_id' => $user->ID ?? 0, 'updated' => time()];
    update_option('glm_push_tokens', $tokens);
    return rest_ensure_response(['success' => true]);
}

function glm_send_push_notification($push_token, $title, $body, $data = []) {
    if (!$push_token) return false;
    $payload = [
        'to'    => $push_token,
        'title' => $title,
        'body'  => $body,
        'data'  => $data,
        'sound' => 'default',
        'badge' => 1,
    ];
    $response = wp_remote_post('https://exp.host/--/api/v2/push/send', [
        'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
        'body'    => json_encode($payload),
        'timeout' => 10,
    ]);
    return !is_wp_error($response);
}

function glm_send_push_to_user($user_id, $title, $body, $data = []) {
    $token = get_user_meta($user_id, '_glm_push_token', true);
    if ($token) glm_send_push_notification($token, $title, $body, $data);
}

function glm_get_me() {
    $user = wp_get_current_user();
    if (!$user || !$user->ID) return new WP_Error('not_logged_in', 'Not logged in', ['status' => 401]);
    $role = !empty($user->roles) ? $user->roles[0] : 'customer';
    return rest_ensure_response([
        'id'           => $user->ID,
        'name'         => $user->display_name,
        'email'        => $user->user_email,
        'user_role'    => $role,
        'is_admin'     => in_array($role, ['administrator', 'editor', 'shop_manager']),
    ]);
}

function glm_is_admin() {
    $user = wp_get_current_user();
    return in_array('administrator', $user->roles) 
        || in_array('editor', $user->roles)
        || in_array('shop_manager', $user->roles);
}

// Stamps are stored as a WP option: array of {id, name, cat, svg_url, price}
function glm_get_stamps() {
    $stamps = get_option('glm_app_stamps', []);
    // Also pull from the existing GLM_CONFIG custom_stamps
    $glm_config = get_option('mgl_cm_gallery', []);
    return rest_ensure_response(['stamps' => $stamps, 'count' => count($stamps)]);
}

function glm_add_stamp(WP_REST_Request $req) {
    $stamps = get_option('glm_app_stamps', []);
    $new = [
        'id'      => time(),
        'name'    => sanitize_text_field($req->get_param('name')),
        'cat'     => sanitize_text_field($req->get_param('cat') ?: 'small'),
        'svg_url' => esc_url_raw($req->get_param('svg_url')),
        'price'   => intval($req->get_param('price') ?: 2),
    ];
    $stamps[] = $new;
    update_option('glm_app_stamps', $stamps);
    return rest_ensure_response(['success' => true, 'stamp' => $new]);
}

function glm_update_stamp(WP_REST_Request $req) {
    $id     = intval($req->get_param('id'));
    $stamps = get_option('glm_app_stamps', []);
    foreach ($stamps as &$s) {
        if ($s['id'] === $id) {
            if ($req->get_param('name'))    $s['name']    = sanitize_text_field($req->get_param('name'));
            if ($req->get_param('cat'))     $s['cat']     = sanitize_text_field($req->get_param('cat'));
            if ($req->get_param('svg_url')) $s['svg_url'] = esc_url_raw($req->get_param('svg_url'));
            if ($req->get_param('price'))   $s['price']   = intval($req->get_param('price'));
            break;
        }
    }
    update_option('glm_app_stamps', $stamps);
    return rest_ensure_response(['success' => true]);
}

function glm_delete_stamp(WP_REST_Request $req) {
    $id     = intval($req->get_param('id'));
    $stamps = get_option('glm_app_stamps', []);
    $stamps = array_values(array_filter($stamps, fn($s) => $s['id'] !== $id));
    update_option('glm_app_stamps', $stamps);
    return rest_ensure_response(['success' => true]);
}

function glm_admin_get_orders() {
    $orders = wc_get_orders(['limit' => 50, 'orderby' => 'date', 'order' => 'DESC']);
    $result = [];
    foreach ($orders as $order) {
        $result[] = [
            'id'              => $order->get_id(),
            'status'          => $order->get_status(),
            'total'           => $order->get_total(),
            'date'            => $order->get_date_created()->date('Y-m-d H:i'),
            'billing_name'    => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
            'billing_email'   => $order->get_billing_email(),
            'billing_phone'   => $order->get_billing_phone(),
            'billing_address' => $order->get_billing_address_1(),
            'billing_city'    => $order->get_billing_city(),
            'finish'          => $order->get_meta('_glm_finish'),
            'sides'           => $order->get_meta('_glm_sides'),
            'color_choice'    => $order->get_meta('_glm_color_choice'),
            'design_image'    => $order->get_meta('_glm_design_image'),
            'design_image_b'  => $order->get_meta('_glm_design_image_b'),
            'tracking_number' => $order->get_meta('_glm_tracking'),
            'carrier'         => $order->get_meta('_glm_carrier'),
            'finished_front'  => $order->get_meta('_glm_finished_front'),
            'finished_back'   => $order->get_meta('_glm_finished_back'),
            'finished_marker' => $order->get_meta('_glm_finished_marker'),
        ];
    }
    return rest_ensure_response($result);
}

function glm_admin_update_status(WP_REST_Request $req) {
    $order = wc_get_order(intval($req->get_param('id')));
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);
    $order->update_status(sanitize_text_field($req->get_param('status')));
    return rest_ensure_response(['success' => true]);
}

function glm_admin_remove_finished_marker(WP_REST_Request $req) {
    $order = wc_get_order(intval($req->get_param('id')));
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);
    $side = sanitize_text_field($req->get_param('side') ?: 'front');
    $order->delete_meta_data('_glm_finished_' . $side);
    $order->save();
    return rest_ensure_response(['success' => true, 'side' => $side]);
}

function glm_admin_upload_finished_marker(WP_REST_Request $req) {
    $order = wc_get_order(intval($req->get_param('id')));
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);
    $image_data = $req->get_param('image');
    $side       = sanitize_text_field($req->get_param('side') ?: 'front'); // 'front' or 'back'
    $filename   = 'glm-finished-' . $order->get_id() . '-' . $side;
    $upload     = glm_save_base64_image($image_data, $filename);
    if ($upload) {
        // Save to order meta — matches WooCommerce backend fields
        $order->update_meta_data('_glm_finished_' . $side, $upload['url']);
        $order->save();
        // No auto-email on upload — admin uses Update Order button to notify customer
    }
    return rest_ensure_response(['success' => true, 'url' => $upload['url'] ?? '', 'side' => $side]);
}

function glm_admin_update_tracking(WP_REST_Request $req) {
    $order = wc_get_order(intval($req->get_param('id')));
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);
    $tracking = sanitize_text_field($req->get_param('tracking_number'));
    $carrier  = sanitize_text_field($req->get_param('carrier'));
    $order->update_meta_data('_glm_tracking', $tracking);
    $order->update_meta_data('_glm_carrier',  $carrier);
    $order->save();
    // No auto-email — admin clicks Update Order to send notification
    return rest_ensure_response(['success' => true]);
}

function glm_admin_notify_customer(WP_REST_Request $req) {
    $order = wc_get_order(intval($req->get_param('id')));
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);

    $customer_email = $order->get_billing_email();
    $customer_name  = $order->get_billing_first_name() ?: $order->get_billing_last_name();
    $order_id       = $order->get_id();
    $finish         = $order->get_meta('_glm_finish') ?: 'Custom Copper';
    $front_url      = $order->get_meta('_glm_finished_front');
    $back_url       = $order->get_meta('_glm_finished_back');
    $tracking       = $order->get_meta('_glm_tracking');
    $carrier        = $order->get_meta('_glm_carrier');

    // Has marker photos
    $has_photos    = $front_url || $back_url;
    $status_update = sanitize_text_field($req->get_param('status_update'));
    $is_shipped    = !empty($tracking);
    $is_completed  = $status_update === 'completed';

    // Subject line
    if ($is_completed) {
        $subject = "Your GLM Order is Complete! — Order #{$order_id}";
    } elseif ($is_shipped) {
        $subject = "Your GLM Marker Has Shipped! 📦 — Order #{$order_id}";
    } else {
        $subject = "Your GLM Marker is Ready! 🎉 — Order #{$order_id}";
    }

    // Headline
    if ($is_completed) {
        $headline = "Your order is complete.";
        $intro1   = "Everything is done and dusted — your custom copper marker has been completed and delivered. We hope you absolutely love it on the course.";
        $intro2   = "It has been a genuine pleasure crafting something so personal for you. Thank you for being part of the Golf Life Metals family.";
    } elseif ($is_shipped) {
        $headline = "Your marker is on its way!";
        $intro1   = "Great news — your custom copper marker has been carefully packaged and shipped. It is now making its way to you and should arrive soon.";
        $intro2   = "Keep an eye on your tracking below. As always, if you have any questions, just reply to this email and I will get back to you personally.";
    } else {
        $headline = "Your marker is ready.";
        $intro1   = "I am so excited to share this with you — your custom copper marker has been completed, and I have to say, it turned out absolutely beautiful.";
        $intro2   = "Every marker I make is truly one of a kind, and yours is no exception. I hope it brings you as much joy on the course as it brought me crafting it for you.";
    }

    // Photos section
    $front_img      = $front_url ? "<img src='{$front_url}' style='width:260px;height:260px;object-fit:contain;border-radius:12px;margin:8px;border:1px solid #eee;' alt='Front of your marker' />" : '';
    $back_img       = $back_url  ? "<img src='{$back_url}'  style='width:260px;height:260px;object-fit:contain;border-radius:12px;margin:8px;border:1px solid #eee;' alt='Back of your marker' />"  : '';
    $photos_section = $has_photos ? "
        <div style='text-align:center;margin:28px 0;background:#f9f7f4;border-radius:12px;padding:20px;'>
            <p style='font-size:11px;color:#B87333;letter-spacing:2px;font-weight:700;margin:0 0 16px;'>YOUR FINISHED MARKER</p>
            <div>{$front_img}{$back_img}</div>
        </div>
    " : '';

    // Tracking section
    $tracking_section = $tracking ? "
        <div style='background:#f5f0eb;border-radius:10px;padding:16px;margin:20px 0;'>
            <p style='margin:0 0 6px;font-size:11px;color:#B87333;font-weight:700;letter-spacing:1px;'>TRACKING INFORMATION</p>
            <p style='margin:0;font-size:15px;color:#111;font-weight:700;'>{$carrier} &nbsp;·&nbsp; {$tracking}</p>
        </div>
    " : ($is_completed ? '' : "
        <p style='color:#888;font-size:14px;line-height:1.7;'>We will send you your tracking number as soon as your order ships — usually within 1-2 business days.</p>
    ");

    $message = "
    <!DOCTYPE html>
    <html>
    <body style='margin:0;padding:0;background:#f0ede8;font-family:Georgia,serif;'>
        <div style='max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>

            <!-- Header -->
            <div style='background:#111;padding:36px 32px;text-align:center;'>
                <p style='color:#B87333;font-size:10px;letter-spacing:4px;margin:0 0 10px;font-family:Arial,sans-serif;'>GOLF LIFE METALS</p>
                <h1 style='color:#fff;font-size:26px;margin:0;font-weight:400;font-style:italic;'>{$headline}</h1>
            </div>

            <!-- Body -->
            <div style='padding:36px 32px;'>
                <p style='font-size:16px;color:#333;line-height:1.7;margin-bottom:16px;'>Hi {$customer_name},</p>
                <p style='font-size:15px;color:#444;line-height:1.9;margin-bottom:16px;'>{$intro1}</p>
                <p style='font-size:15px;color:#444;line-height:1.9;margin-bottom:24px;'>{$intro2}</p>

                {$photos_section}

                <div style='border-top:1px solid #eee;padding-top:20px;margin-top:8px;'>
                    <p style='font-size:11px;color:#B87333;letter-spacing:1px;font-weight:700;margin-bottom:8px;font-family:Arial,sans-serif;'>ORDER #{$order_id} &nbsp;·&nbsp; {$finish}</p>
                    {$tracking_section}
                </div>

                <p style='font-size:15px;color:#444;line-height:1.9;margin-top:28px;'>
                    Thank you so much for trusting me with your design.<br>
                    It means the world to me and to Golf Life Metals.
                </p>

                <p style='font-size:15px;color:#333;margin-top:24px;'>
                    With gratitude,<br>
                    <strong style='font-size:17px;'>Jon</strong><br>
                    <span style='color:#B87333;font-size:13px;font-family:Arial,sans-serif;'>Golf Life Metals</span>
                </p>
            </div>

            <!-- Footer -->
            <div style='background:#111;padding:20px;text-align:center;'>
                <p style='color:#555;font-size:11px;margin:0;font-family:Arial,sans-serif;'>glmgolf.com &nbsp;·&nbsp; Custom Copper Golf Markers &nbsp;·&nbsp; Handcrafted One of a Kind</p>
            </div>
        </div>
    </body>
    </html>";

    $headers = ['Content-Type: text/html; charset=UTF-8', 'From: Golf Life Metals <orders@golflifemetals.com>'];
    $sent = wp_mail($customer_email, $subject, $message, $headers);

    // Also send push notification to customer's device
    $customer_id = $order->get_customer_id();
    if ($customer_id) {
        if ($is_completed) {
            glm_send_push_to_user($customer_id, '✅ Order Complete!', 'Your GLM marker order #' . $order_id . ' is complete. Thank you!', ['order_id' => $order_id]);
        } elseif ($is_shipped) {
            glm_send_push_to_user($customer_id, '📦 Your Marker Shipped!', 'Your GLM marker is on its way. Tracking: ' . $tracking, ['order_id' => $order_id, 'tracking' => $tracking]);
        } else {
            glm_send_push_to_user($customer_id, '🎉 Your Marker is Ready!', 'Jon has completed your custom copper marker. Check it out!', ['order_id' => $order_id]);
        }
    }

    return rest_ensure_response(['success' => $sent, 'message' => $sent ? 'Customer notified.' : 'Email failed.']);
}

function glm_save_base64_image($base64, $filename) {
    $upload_dir = wp_upload_dir();
    $data = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64));
    $file = $upload_dir['path'] . '/' . $filename . '.jpg';
    file_put_contents($file, $data);
    return ['url' => $upload_dir['url'] . '/' . $filename . '.jpg'];
}
