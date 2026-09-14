<?php

use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Profile
|--------------------------------------------------------------------------
|
| Whose CV this site is. Everything here is identity or contact detail that
| appears in the AI avatar's prompts and in its answers, so it belongs in one
| place rather than scattered through string literals.
|
| Narrative copy and the CV's own content are deliberately NOT here - those
| live in /CV, which is the single source of truth the agent reads.
|
*/

$name = env('PROFILE_NAME', 'Ismail Ibrahim');

return [

    'name' => $name,

    /*
     * Used where the prompt addresses the person conversationally. Derived so
     * there is no second variable to keep in step with the first.
     */
    'first_name' => env('PROFILE_FIRST_NAME', Str::before($name, ' ')),

    'title' => env('PROFILE_TITLE', 'Lead Software Engineer'),

    /*
     * The avatar hands this out whenever the CV cannot answer something, so an
     * empty value would produce a dead end in the one place the visitor is
     * most likely to want a reply.
     */
    'email' => env('PROFILE_EMAIL'),

    'phone' => env('PROFILE_PHONE'),

    'linkedin' => env('PROFILE_LINKEDIN'),

    'location' => env('PROFILE_LOCATION', 'Remote'),

    /*
     * Current availability, shown on the site and usable by the agent when a
     * visitor asks whether he is open to work. It changes far more often than
     * anything else here, which is exactly why it should not be a literal in a
     * component.
     */
    'availability' => env('PROFILE_AVAILABILITY', 'Open to senior, lead & fractional CTO roles'),

];
