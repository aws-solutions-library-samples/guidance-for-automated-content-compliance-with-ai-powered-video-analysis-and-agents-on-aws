"""
Perceptual image hash calculation tool based on algorithm described in
Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu
"""

import math
from PIL import Image
import commoncode
import boto3
import io
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

ONE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]
MAX_FRAMES_PER_INVOCATION = 3000
HASH_THUMBNAIL_SIZE = (256, 256)
PREFETCH_THREADS = 8

s3_client = boto3.client('s3')
dynamodb = boto3.client('dynamodb')

def update_analysis_results(session_id: str, total_frames: int, frames_to_analyse: int):
    analysis_results_table = commoncode.get_parameters()['ANALYSIS_RESULTS_TABLE']        
    now = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')    

    expression = "SET totalFrames = :totalFrames, framesToAnalyse = :framesToAnalyse, framesAnalysed = :framesAnalysed, updatedAt = :now"

    expression_values = {
        ':totalFrames' : { 'N' : str(total_frames) },
        ':framesToAnalyse' : { 'N' : str(frames_to_analyse) },
        ':framesAnalysed': { 'N' : "0" }, # initially set to 0
        ':now' : { 'S' : now }
    }

    dynamodb.update_item(
        TableName=analysis_results_table,
        Key={'sessionId': {'S': session_id}},
        UpdateExpression=expression,
        ExpressionAttributeValues=expression_values
    )

def hamming_distance(hash1, hash2):
    """Calculate the hamming distance for two hashes in hex format"""
    if len(hash1) != len(hash2):
        raise ValueError("Can't compare hashes with different length")
    
    d = 0
    for i in range(len(hash1)):
        n1 = int(hash1[i], 16)
        n2 = int(hash2[i], 16)
        d += ONE_BITS[n1 ^ n2]
    return d

def median(data):
    """Calculate median of a list"""
    sorted_data = sorted(data)
    length = len(sorted_data)
    if length % 2 == 0:
        return (sorted_data[length//2 - 1] + sorted_data[length//2]) / 2.0
    return sorted_data[length//2]

def translate_blocks_to_bits(blocks, pixels_per_block):
    """Convert block values to binary bits based on median comparison"""
    half_block_value = pixels_per_block * 256 * 3 / 2
    bandsize = len(blocks) // 4
    
    # Compare medians across four horizontal bands
    for i in range(4):
        band_blocks = blocks[i * bandsize:(i + 1) * bandsize]
        m = median(band_blocks)
        
        for j in range(i * bandsize, (i + 1) * bandsize):
            v = blocks[j]
            # Output 1 if block is brighter than median
            blocks[j] = int(v > m or (abs(v - m) < 1 and m > half_block_value))

def bits_to_hexhash(bits_array):
    """Convert binary bits array to hexadecimal hash string"""
    hex_chars = []
    for i in range(0, len(bits_array), 4):
        nibble = bits_array[i:i+4]
        nibble_str = ''.join(map(str, nibble))
        hex_chars.append(format(int(nibble_str, 2), 'x'))
    return ''.join(hex_chars)

def bmvbhash_even(img_data, bits):
    """Hash calculation for images with dimensions evenly divisible by bits"""
    width, height, data = img_data['width'], img_data['height'], img_data['data']
    blocksize_x = width // bits
    blocksize_y = height // bits
    
    result = []
    
    for y in range(bits):
        for x in range(bits):
            total = 0
            
            for iy in range(blocksize_y):
                for ix in range(blocksize_x):
                    cx = x * blocksize_x + ix
                    cy = y * blocksize_y + iy
                    ii = (cy * width + cx) * 4
                    
                    alpha = data[ii + 3]
                    if alpha == 0:
                        total += 765
                    else:
                        total += data[ii] + data[ii + 1] + data[ii + 2]
            
            result.append(total)
    
    translate_blocks_to_bits(result, blocksize_x * blocksize_y)
    return bits_to_hexhash(result)

def bmvbhash(img_data, bits):
    """Hash calculation with weighted pixel distribution for uneven dimensions"""
    width, height, data = img_data['width'], img_data['height'], img_data['data']
    
    even_x = width % bits == 0
    even_y = height % bits == 0
    
    if even_x and even_y:
        return bmvbhash_even(img_data, bits)
    
    # Initialize blocks array
    blocks = [[0 for _ in range(bits)] for _ in range(bits)]
    
    block_width = width / bits
    block_height = height / bits
    
    for y in range(height):
        if even_y:
            block_top = block_bottom = int(y // block_height)
            weight_top, weight_bottom = 1, 0
        else:
            y_mod = (y + 1) % block_height
            y_frac = y_mod - math.floor(y_mod)
            y_int = y_mod - y_frac
            
            weight_top = 1 - y_frac
            weight_bottom = y_frac
            
            if y_int > 0 or (y + 1) == height:
                block_top = block_bottom = int(y // block_height)
            else:
                block_top = int(y // block_height)
                block_bottom = int(math.ceil(y / block_height))
        
        for x in range(width):
            ii = (y * width + x) * 4
            
            alpha = data[ii + 3]
            if alpha == 0:
                avgvalue = 765
            else:
                avgvalue = data[ii] + data[ii + 1] + data[ii + 2]
            
            if even_x:
                block_left = block_right = int(x // block_width)
                weight_left, weight_right = 1, 0
            else:
                x_mod = (x + 1) % block_width
                x_frac = x_mod - math.floor(x_mod)
                x_int = x_mod - x_frac
                
                weight_left = 1 - x_frac
                weight_right = x_frac
                
                if x_int > 0 or (x + 1) == width:
                    block_left = block_right = int(x // block_width)
                else:
                    block_left = int(x // block_width)
                    block_right = int(math.ceil(x / block_width))
            
            # Add weighted pixel value to relevant blocks
            blocks[block_top][block_left] += avgvalue * weight_top * weight_left
            blocks[block_top][block_right] += avgvalue * weight_top * weight_right
            blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left
            blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right
    
    # Flatten blocks array
    result = []
    for i in range(bits):
        for j in range(bits):
            result.append(blocks[i][j])
    
    translate_blocks_to_bits(result, block_width * block_height)
    return bits_to_hexhash(result)

def blockhash_data(img_data, bits, method):
    """Calculate hash from image data"""
    if method == 1:
        return bmvbhash_even(img_data, bits)
    elif method == 2:
        return bmvbhash(img_data, bits)
    else:
        raise ValueError("Bad hashing method")

def blockhash(img, bits=16, method=2):
    """Calculate perceptual hash from image file"""
    try:
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Convert PIL image to flat list
        pixels = list(img.getdata())
        data = []
        for pixel in pixels:
            data.extend(pixel)
        
        img_data = {
            'width': img.width,
            'height': img.height,
            'data': data
        }
        
        return blockhash_data(img_data, bits, method)
    
    except Exception as e:
        raise Exception(f"Error processing image: {str(e)}")

def download_and_hash(bucket, frame, bits, method):
    """Download a frame from S3, downscale it, and compute its perceptual hash."""
    frame_data = s3_client.get_object(Bucket=bucket, Key=frame)['Body'].read()
    frame_image = Image.open(io.BytesIO(frame_data))
    frame_image.thumbnail(HASH_THUMBNAIL_SIZE)
    return frame, blockhash(frame_image, bits, method)

def frame_hash(bucket, frame, bits, method):
    """Single-frame hash for backward compatibility (used on resume)."""
    _, hash_value = download_and_hash(bucket, frame, bits, method)
    return hash_value

def manifest_filename(thumbnail_prefix):
    return f"{thumbnail_prefix}segment_based_selection_manifest.json"

def process_frames(bucket, s3VideoObjectKey, thumbnail_prefix, threshold, bits=16, method=2):
    # This method is designed to pick up where it left off on subsequent runs so that
    # processing can be broken up into a series of lambda invocations

    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff'}

    files = sorted(commoncode.list_all_objects(bucket, thumbnail_prefix))
    files = [f for f in files if any(f.lower().endswith(ext) for ext in image_extensions)]
    
    results = commoncode.load_s3_json_file(bucket, manifest_filename(thumbnail_prefix), [])
    last_hash = None
    if results:
        print(f"Resuming after {len(results)} selected frames")
        last_hash = frame_hash(bucket, results[-1]['thumbnail'], bits, method)

    # Filter to only unprocessed frames
    if results:
        last_processed = results[-1]['thumbnail']
        pending_frames = [f for f in files if f > last_processed]
    else:
        pending_frames = files

    calculated = 0
    i = 0
    while i < len(pending_frames):
        # Pre-fetch a batch of frames in parallel
        batch_end = min(i + PREFETCH_THREADS, len(pending_frames))
        batch = pending_frames[i:batch_end]

        # Download and hash frames concurrently
        hash_map = {}
        with ThreadPoolExecutor(max_workers=PREFETCH_THREADS) as executor:
            futures = {executor.submit(download_and_hash, bucket, frame, bits, method): frame for frame in batch}
            for future in as_completed(futures):
                try:
                    frame, hash_value = future.result()
                    hash_map[frame] = hash_value
                except Exception as e:
                    print(f"Error processing {futures[future]}: {str(e)}")

        # Sequential comparison in original order
        for frame in batch:
            if frame not in hash_map:
                continue
            calculated += 1
            hash_value = hash_map[frame]
            if not last_hash or hamming_distance(hash_value, last_hash) >= threshold:
                results.append({
                    'bucketName': bucket,
                    's3VideoObjectKey': s3VideoObjectKey,
                    'thumbnail': frame
                })
                last_hash = hash_value

            if calculated > MAX_FRAMES_PER_INVOCATION:
                total_processed = len(files) - len(pending_frames) + calculated
                commoncode.log_output_message(bucket, s3VideoObjectKey, f"Selecting frames for analysis - processed {total_processed} / {len(files)}")
                print(f"Processed {total_processed} frames. Exiting to allow a new invocation to continue")
                commoncode.store_json_file(bucket, manifest_filename(thumbnail_prefix), results)
                return None, None

        i = batch_end

    commoncode.store_json_file(bucket, manifest_filename(thumbnail_prefix), results)
    print("Selected " + str(len(results)) + " of " + str(len(files)) + " frames")
    return len(files), len(results)


def handler(event, context):
    bucket = event.get('bucketName')
    s3VideoObjectKey = event.get('s3VideoObjectKey')
    thumbnail_prefix = commoncode.get_thumbnails_prefix(s3VideoObjectKey)

    threshold = 60
    config, config_type = commoncode.get_relevant_config(bucket, s3VideoObjectKey)
    defaultDetailedReportConfig = config['defaultDetailedReportConfig']
    if 'phashThreshold' in defaultDetailedReportConfig:
        threshold = int(defaultDetailedReportConfig['phashThreshold'])
        print(f"Using phash threshold of {threshold} from configuration")

    frame_count, selected_count = process_frames(
        bucket, 
        s3VideoObjectKey,
        thumbnail_prefix, 
        threshold
    )

    if not frame_count:
        return {
            'framesSelected' : False
        }

    update_analysis_results(
        commoncode.extract_session_from_object(bucket, s3VideoObjectKey), 
        frame_count, 
        selected_count
    )

    return {
        'framesSelected' : True,
        'selected_frames_for_analysis' : manifest_filename(thumbnail_prefix),
        'total_frames' : frame_count,
        'frames_to_analyse' : selected_count
    }
