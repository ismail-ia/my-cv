<?php

namespace Tests\Support;

use Illuminate\Contracts\Broadcasting\Broadcaster;

/**
 * Captures what would go over the wire.
 *
 * Broadcast::on(...)->sendNow() builds an AnonymousEvent and hands it to the
 * broadcast manager, so Event::fake() never sees the channel, event name or
 * payload. Swapping the driver is the only place all three are visible
 * together - which is exactly the contract the browser depends on.
 */
class RecordingBroadcaster implements Broadcaster
{
    /** @var list<array{channels: list<string>, event: string, payload: array<string, mixed>}> */
    public array $sent = [];

    public function auth($request)
    {
        return true;
    }

    public function validAuthenticationResponse($request, $result)
    {
        return $result;
    }

    public function broadcast(array $channels, $event, array $payload = []): void
    {
        $this->sent[] = [
            'channels' => array_map(strval(...), $channels),
            'event' => $event,
            'payload' => $payload,
        ];
    }

    /** @return list<array{channels: list<string>, event: string, payload: array<string, mixed>}> */
    public function ofType(string $event): array
    {
        return array_values(array_filter($this->sent, fn (array $m): bool => $m['event'] === $event));
    }

    public function textOf(string $event): string
    {
        return implode('', array_map(
            static fn (array $m): string => $m['payload']['delta'] ?? '',
            $this->ofType($event),
        ));
    }
}
