<?php

namespace App\Models;

use App\Models\Concerns\UsesAppTimezone;
use Illuminate\Database\Eloquent\Model as EloquentModel;

abstract class Model extends EloquentModel
{
    use UsesAppTimezone;
}
