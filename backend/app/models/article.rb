class Article < ActiveRecord::Base
  include Utils

  before_save :published_post, :time_to_read
  after_save :update_published_articles_count

  scope :popular, -> { order('hotness DESC') }
  scope :best, -> { order('recommendations_count DESC') }
  scope :recents, -> { order('published_at DESC') }

  belongs_to :user
  has_many :recommendations, :dependent => :destroy
  has_many :comments, :dependent => :destroy
  belongs_to :topic
  has_one :category, through: :topic, autosave: false

  dragonfly_accessor :cover do
    storage_options do |attachment|
      { headers: {"x-amz-acl" => "public-read-write"} }
    end
  end

  abs_url_for :cover

  scope :public, -> { where(published: true) }
  scope :drafts, -> { where(published: false) }

  # Instance Methods.
  def publish!
    self.published = true
    self.save
  end

  # Add published at date only for the published posts.
  def published_post
    if self.published && self.published_at.nil?
      self.published_at = Time.now
    end
  end

  def draft?
    not self.published
  end

  def next
    next_article = Article.public.popular.where('hotness < ?', hotness).first
    if next_article.nil?
        next_article = Article.public.popular.where('hotness > ?', hotness).first
    end
    next_article
  end

  def time_to_read
    self.reading_time = (word_count / 200.0).round
  end

  def word_count
    self.body.split.size
  end

  def update_published_articles_count
    self.user.published_articles_count = self.user.published_articles.count
  end

end
