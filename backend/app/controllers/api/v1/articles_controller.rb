class Api::V1::ArticlesController < ApplicationController

  before_filter :authenticate_user!, except: [:index, :show]
  before_filter :load_query, only: [:index]
  respond_to :json

  # GET /api/v1/articles
  # GET /api/v1/articles.json
  # GET /api/v1/categories/1/articles
  # GET /api/v1/categories/1/articles.json
  # GET /api/v1/categories/1/topics/1/articles
  # GET /api/v1/categories/1/topics/1/articles.json
  def index
    # Use the custom Article.public method to return all articles that is
    # marked published.
    @articles = @query.public.try(order_param).preload(:user, :topic)
    render 'api/v1/articles/index'
  end

  # GET /api/v1/articles/1
  # GET /api/v1/articles/1.json
  def show
    @article = Article.find(params[:id])
    authorize @article
    @next = @article.next
    render 'api/v1/articles/show'
  end

  # POST /api/v1/articles
  # POST /api/v1/articles.json
  def create
    @article = current_user.articles.new(article_params)
    authorize @article
    if @article.save
      ArticleRankingWorker.perform_async(@article.id)
      render 'api/v1/articles/show', status: :created
    else
      render json: @article.errors, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /api/v1/articles/1
  # PATCH/PUT /api/v1/articles/1.json
  def update
    @article = Article.find(params[:id])
    authorize @article
    if @article.update(article_params)
      render 'api/v1/articles/show'
    else
      render json: @article.errors, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/articles/1
  # DELETE /api/v1/articles/1.json
  def destroy
    @article = Article.find(params[:id])
    authorize @article
    @article.destroy
    head :no_content
  end


  private

  def load_query
    if params[:topic_id]
      @query = Topic.find(params[:topic_id]).articles.public
    elsif params[:category_id]
      @query = Category.find(params[:category_id]).articles.public
    else
      @query = Article.public
    end
  end

  def article_params
    params.require(
      :article).permit(
        :title, :tagline, :body, :published, :cover, :topic_id)
  end

  def order_param
    # It is important not to allow other values for order otherwise
    # users can run malicious method on all articles :-).
    permitted_orders = ['popular', 'best', 'recents']
    if permitted_orders.include?(params[:order])
      params[:order]
    else
      :best
    end
  end
end
