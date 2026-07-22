<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

const DB_PATH = __DIR__ . '/../data/checkins.sqlite';
const PEOPLE = ['anu', 'varun'];

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function db(): PDO
{
    $directory = dirname(DB_PATH);
    if (!is_dir($directory)) {
        mkdir($directory, 0775, true);
    }

    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS checkins (
            person TEXT PRIMARY KEY,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            accuracy REAL,
            checked_in_at TEXT NOT NULL
        )'
    );

    return $pdo;
}

function latestCheckins(PDO $pdo): array
{
    $statement = $pdo->query('SELECT person, latitude, longitude, accuracy, checked_in_at FROM checkins');
    $checkins = ['anu' => null, 'varun' => null];

    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $checkins[$row['person']] = [
            'latitude' => (float) $row['latitude'],
            'longitude' => (float) $row['longitude'],
            'accuracy' => $row['accuracy'] === null ? null : (float) $row['accuracy'],
            'checked_in_at' => $row['checked_in_at'],
        ];
    }

    return $checkins;
}

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        respond(['ok' => true]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        respond(['checkins' => latestCheckins($pdo)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['error' => 'Unsupported request method.'], 405);
    }

    $rawInput = file_get_contents('php://input') ?: '';
    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        respond(['error' => 'Invalid JSON body. Send Content-Type: application/json with person, latitude, and longitude.'], 400);
    }

    $person = strtolower((string) ($input['person'] ?? ''));
    $latitude = filter_var($input['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $longitude = filter_var($input['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $accuracy = filter_var($input['accuracy'] ?? null, FILTER_VALIDATE_FLOAT, FILTER_NULL_ON_FAILURE);

    if (!in_array($person, PEOPLE, true)) {
        respond(['error' => 'Choose Anu or Varun before checking in.'], 422);
    }

    if ($latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        respond(['error' => 'Location coordinates are invalid.'], 422);
    }

    $checkedInAt = gmdate('c');
    $statement = $pdo->prepare(
        'INSERT INTO checkins (person, latitude, longitude, accuracy, checked_in_at)
         VALUES (:person, :latitude, :longitude, :accuracy, :checked_in_at)
         ON CONFLICT(person) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            accuracy = excluded.accuracy,
            checked_in_at = excluded.checked_in_at'
    );
    $statement->execute([
        ':person' => $person,
        ':latitude' => $latitude,
        ':longitude' => $longitude,
        ':accuracy' => $accuracy,
        ':checked_in_at' => $checkedInAt,
    ]);

    respond(['checkins' => latestCheckins($pdo)]);
} catch (Throwable $exception) {
    respond(['error' => 'Check-in storage is unavailable.'], 500);
}
