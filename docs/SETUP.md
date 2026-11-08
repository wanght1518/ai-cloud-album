# Setup / 运行说明

## Backend / 后端

Use Python 3.11 (as used in the Dockerfile), create a virtual environment, and install `backend/requirements.txt`.

Copy `backend/.env.example` to `backend/.env` and replace every placeholder. Supply AWS credentials through your AWS profile/environment or an IAM role. Do not commit credentials. The backend does not explicitly load `.env`; use Flask's CLI or Docker's `--env-file`.

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env before starting.
flask --app wsgi:app run --port 5000
```

For Docker, run from `backend/`:

```bash
docker build -t ai-cloud-album-backend .
docker run --env-file .env -p 5000:8000 ai-cloud-album-backend
```

Use `wsgi:app` for Gunicorn. `app:app` refers to a separate bare Flask instance in the original source and does not register the application routes.

中文：先替换环境变量示例中的占位符，并配置 AWS 凭证。使用上述 Flask CLI 或 Docker 启动；直接运行 `python app.py` 不会自动读取 `.env`。Gunicorn 入口使用 `wsgi:app`。

## AWS resources / 云资源

| Resource | Required shape |
| --- | --- |
| Image S3 bucket | Private image/ZIP storage; configure `S3_BUCKET` |
| Users table | String partition key `user_id`; no sort key |
| ImageMetadata table | String partition key `user_id`, string sort key `image_id` |
| ZipJobs table | String partition key `user_id`, string sort key `job_id` |
| image-processing-queue | Event source for classification Lambda |
| zip-upload-queue | Event source for ZIP extraction Lambda |
| download-queue | Event source for ZIP download Lambda |

Table names may be changed through environment variables. The backend uses `DYNAMODB_JOB_TABLE`; ZIP Lambdas use `DYNAMODB_ZIP_JOBS_TABLE`. Both must point to the same jobs table. Configure worker environment variables using `lambda/.env.example`, each worker's source, and the schema/message docs.

Package the classification handler with `processor.py`, `labels.py`, the retained ONNX model, and compatible `boto3`, `numpy`, `Pillow`, and `onnxruntime` dependencies for the chosen Lambda runtime/architecture. Other workers require their imported dependencies. Configure IAM, SQS event sources, timeouts, retries and permissions for your deployment. Do not assume one SQS message always equals exactly one invocation.

中文：DynamoDB 三张表的键结构如上。注意后端和 Lambda 的任务表环境变量名称不同。分类 Lambda 需要自行打包与运行环境兼容的依赖。

## Frontend / 前端

From `frontend/`, start a static server:

```bash
python -m http.server 8080
```

Visit `http://localhost:8080/pages/login.html`. The API defaults to `http://localhost:5000`. For a different backend, set the following in the browser console on the frontend origin and reload:

```javascript
localStorage.setItem("API_BASE_URL", "https://your-api.example.com");
```

Set backend `CORS_ORIGINS` to the actual frontend origin (comma-separated if more than one). For S3 hosting, preserve the `pages/` and `static/` layout and use `pages/login.html` as the entry path, or adjust paths consistently. Do not flatten the pages without updating asset references.

中文：本地访问 `/pages/login.html`。部署时修改 API 地址并配置后端允许的前端来源。S3 托管需保留页面与静态文件的相对目录关系。

## Tests and training / 测试与训练

The API integration suite is `backend/tests/test_api.py`. It defaults to localhost and requires `requests`, `pytest`, a running configured backend, `backend/tests/test.jpg`, and a locally supplied `backend/tests/test.zip`. Use non-sensitive images to create that ZIP. The suite mutates the configured deployment.

`lambda/test_docker_handlers.py` provides a separate local pipeline harness with fake AWS services; it requires model dependencies and a dataset supplied with `--dataset-root`.

Set `DATASET_DIR` before running `lambda/yolov8/temp_train.py`; install the training requirements and obtain an appropriately licensed dataset yourself. Training checkpoints are excluded. `data/image_info` contains experimental coordinate artifacts and should not be treated as evidence of real photo locations.

中文：测试 ZIP 与训练数据需自行准备。
