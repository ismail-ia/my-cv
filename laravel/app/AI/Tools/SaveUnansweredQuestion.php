<?php

namespace App\AI\Tools;

use App\Models\UnansweredQuestion;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SaveUnansweredQuestion implements Tool
{
    public function description(): Stringable|string
    {
        return 'Save a question to the database when you are unable to answer it or do not have enough information about the user/master profile.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'question' => $schema->string()->required()->description('The exact question that could not be answered'),
        ];
    }

    public function handle(Request $request): Stringable|string
    {
        UnansweredQuestion::create([
            'question' => $request['question'],
        ]);

        return 'The question has been recorded and will be reviewed later.';
    }
}
