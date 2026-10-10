<?php
/**
 * Plugin Name: Psychiatry Residency Study Planner
 * Description: A single-user, cross-device psychiatry residency study planner. Data is stored in the logged-in WordPress user's account.
 * Version: 1.4.4
 * Author: EHIA
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

final class Psychiatry_Study_Planner {
    const VERSION = '1.4.4';
    const META_KEY = '_psychiatry_study_planner_workspace_v1';
    const REST_NAMESPACE = 'psychiatry-study-planner/v1';
    const REST_ROUTE = '/workspace';

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
        add_shortcode( 'psychiatry_study_planner', array( __CLASS__, 'shortcode' ) );
    }

    public static function shortcode() {
        if ( ! is_user_logged_in() ) {
            $login_url = wp_login_url( get_permalink() );
            return '<div class="psp-login-required">Please <a href="' . esc_url( $login_url ) . '">log in</a> to access your Psychiatry Study Planner.</div>';
        }

        wp_enqueue_style(
            'psp-google-fonts',
            'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap',
            array(),
            null
        );
        wp_enqueue_style(
            'psp-app',
            plugin_dir_url( __FILE__ ) . 'assets/app.css',
            array( 'psp-google-fonts' ),
            self::VERSION
        );
        wp_enqueue_script(
            'psp-app',
            plugin_dir_url( __FILE__ ) . 'assets/app.js',
            array(),
            self::VERSION,
            true
        );

        wp_localize_script(
            'psp-app',
            'PsychiatryStudyPlannerConfig',
            array(
                'restUrl' => esc_url_raw( rest_url( self::REST_NAMESPACE . self::REST_ROUTE ) ),
                'nonce'   => wp_create_nonce( 'wp_rest' ),
                'userId'  => get_current_user_id(),
            )
        );

        return '<div class="psp-app" dir="rtl"><div id="app" class="app-shell"><div class="psp-loading">Loading Psychiatry Study Planner…</div></div></div>';
    }

    public static function register_rest_routes() {
        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_ROUTE,
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( __CLASS__, 'get_workspace' ),
                'permission_callback' => array( __CLASS__, 'permissions_check' ),
            )
        );

        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_ROUTE,
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array( __CLASS__, 'save_workspace' ),
                'permission_callback' => array( __CLASS__, 'permissions_check' ),
            )
        );
    }

    public static function permissions_check() {
        return is_user_logged_in();
    }

    public static function get_workspace() {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return new WP_Error( 'psp_not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
        }

        $workspace = get_user_meta( $user_id, self::META_KEY, true );
        if ( ! is_array( $workspace ) ) {
            return rest_ensure_response(
                array(
                    'saved' => false,
                    'data'  => null,
                )
            );
        }

        return rest_ensure_response(
            array(
                'saved' => true,
                'data'  => $workspace,
            )
        );
    }

    public static function save_workspace( WP_REST_Request $request ) {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return new WP_Error( 'psp_not_logged_in', 'You must be logged in.', array( 'status' => 401 ) );
        }

        $payload = $request->get_json_params();
        if ( ! is_array( $payload ) ) {
            return new WP_Error( 'psp_invalid_payload', 'Invalid workspace payload.', array( 'status' => 400 ) );
        }

        $workspace = self::sanitize_workspace( $payload );
        if ( false === update_user_meta( $user_id, self::META_KEY, $workspace ) ) {
            // update_user_meta returns false when nothing changed as well. Verify persisted value before treating as failure.
            $stored = get_user_meta( $user_id, self::META_KEY, true );
            if ( $stored !== $workspace ) {
                return new WP_Error( 'psp_save_failed', 'Workspace could not be saved.', array( 'status' => 500 ) );
            }
        }

        return rest_ensure_response(
            array(
                'saved' => true,
                'data'  => $workspace,
            )
        );
    }

    private static function sanitize_workspace( $workspace ) {
        $safe = array(
            'weeks'       => array(),
            'tasks'       => array(),
            'sessions'    => array(),
            'topicChecks' => array(),
            'notesByWeek' => array(),
        );

        if ( ! empty( $workspace['weeks'] ) && is_array( $workspace['weeks'] ) ) {
            foreach ( array_slice( $workspace['weeks'], 0, 24 ) as $week ) {
                if ( ! is_array( $week ) ) {
                    continue;
                }
                $topics = array();
                if ( ! empty( $week['topics'] ) && is_array( $week['topics'] ) ) {
                    foreach ( array_slice( $week['topics'], 0, 100 ) as $topic ) {
                        $topics[] = sanitize_text_field( $topic );
                    }
                }
                $tasman = array();
                if ( ! empty( $week['tasman'] ) && is_array( $week['tasman'] ) ) {
                    foreach ( array_slice( $week['tasman'], 0, 25 ) as $item ) {
                        $tasman[] = sanitize_text_field( $item );
                    }
                }
                $safe['weeks'][] = array(
                    'number'     => max( 1, min( 24, absint( $week['number'] ?? 0 ) ) ),
                    'title'      => sanitize_text_field( $week['title'] ?? '' ),
                    'kaplan'     => sanitize_text_field( $week['kaplan'] ?? '' ),
                    'objective'  => sanitize_textarea_field( $week['objective'] ?? '' ),
                    'tasman'     => $tasman,
                    'targetHours'=> max( 0, min( 999, (float) ( $week['targetHours'] ?? 8 ) ) ),
                    'topics'     => $topics,
                );
            }
        }

        if ( ! empty( $workspace['tasks'] ) && is_array( $workspace['tasks'] ) ) {
            foreach ( array_slice( $workspace['tasks'], 0, 100 ) as $task ) {
                if ( ! is_array( $task ) ) {
                    continue;
                }
                $safe['tasks'][] = array(
                    'id'        => sanitize_key( $task['id'] ?? '' ),
                    'title'     => sanitize_text_field( $task['title'] ?? '' ),
                    'done'      => ! empty( $task['done'] ),
                    'weekNumber'=> max( 1, min( 24, absint( $task['weekNumber'] ?? 1 ) ) ),
                );
            }
        }

        if ( ! empty( $workspace['sessions'] ) && is_array( $workspace['sessions'] ) ) {
            foreach ( array_slice( $workspace['sessions'], 0, 500 ) as $session ) {
                if ( ! is_array( $session ) ) {
                    continue;
                }
                $safe['sessions'][] = array(
                    'id'       => sanitize_key( $session['id'] ?? '' ),
                    'weekNumber'=> max( 1, min( 24, absint( $session['weekNumber'] ?? 0 ) ) ),
                    'minutes'  => max( 0, min( 24 * 60, absint( $session['minutes'] ?? 0 ) ) ),
                    'resource' => sanitize_text_field( $session['resource'] ?? '' ),
                    'note'     => sanitize_textarea_field( $session['note'] ?? '' ),
                    'loggedAt' => sanitize_text_field( $session['loggedAt'] ?? '' ),
                );
            }
        }

        if ( ! empty( $workspace['topicChecks'] ) && is_array( $workspace['topicChecks'] ) ) {
            foreach ( array_slice( $workspace['topicChecks'], 0, 500 ) as $key => $checked ) {
                $safe['topicChecks'][ sanitize_text_field( $key ) ] = ! empty( $checked );
            }
        }

        if ( ! empty( $workspace['notesByWeek'] ) && is_array( $workspace['notesByWeek'] ) ) {
            foreach ( array_slice( $workspace['notesByWeek'], 0, 24, true ) as $key => $note ) {
                $safe['notesByWeek'][ (string) absint( $key ) ] = sanitize_textarea_field( $note );
            }
        }

        if ( isset( $workspace['currentRotation'] ) && is_array( $workspace['currentRotation'] ) ) {
            $safe['currentRotation'] = self::sanitize_nested_value( $workspace['currentRotation'], 0 );
        }
        if ( isset( $workspace['knowledge'] ) && is_array( $workspace['knowledge'] ) ) {
            $safe['knowledge'] = self::sanitize_nested_value( $workspace['knowledge'], 0 );
        }

        return $safe;
    }

    /**
     * Sanitize bounded nested knowledge records while preserving user-defined fields.
     */
    private static function sanitize_nested_value( $value, $depth = 0 ) {
        if ( $depth > 6 ) {
            return '';
        }
        if ( is_array( $value ) ) {
            $safe = array();
            $count = 0;
            foreach ( $value as $key => $item ) {
                if ( $count++ >= 1000 ) {
                    break;
                }
                $safe_key = is_int( $key ) ? $key : preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $key );
                $safe[ $safe_key ] = self::sanitize_nested_value( $item, $depth + 1 );
            }
            return $safe;
        }
        if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
            return $value;
        }
        $text = (string) $value;
        if ( preg_match( '#^https?://#i', $text ) ) {
            return esc_url_raw( $text );
        }
        return sanitize_textarea_field( $text );
    }
}

Psychiatry_Study_Planner::init();
