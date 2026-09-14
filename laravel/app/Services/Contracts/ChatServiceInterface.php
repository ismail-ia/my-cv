<?php

namespace App\Services\Contracts;

interface ChatServiceInterface
{
    /**
     * Process an incoming chat message and return/stream the response.
     *
     * @param string $chatId
     * @param string $message
     * @return void
     */
    public function processMessage(string $chatId, string $message): void;
}
