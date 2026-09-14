<?php

namespace App\AI\Tools;

use App\Models\CommunicationRequest;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SaveCommunicationRequest implements Tool
{
    public function description(): Stringable|string
    {
        return 'Save the user\'s communication request (e.g. name, email, phone) to the database when they ask to be contacted or want to leave their details.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'name' => $schema->string()->required()->description('The name of the user'),
            'email' => $schema->string()->required()->description('The email address of the user'),
            'phone' => $schema->string()->description('The phone number of the user, if provided'),
        ];
    }

    public function handle(Request $request): Stringable|string
    {
        CommunicationRequest::create([
            'name' => $request['name'],
            'email' => $request['email'],
            'phone' => $request['phone'] ?? null,
        ]);

        return 'The communication request has been saved successfully.';
    }
}
