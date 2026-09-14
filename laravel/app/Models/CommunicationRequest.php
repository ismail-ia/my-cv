<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunicationRequest extends Model
{
    protected $fillable = ['name', 'email', 'phone'];
}
