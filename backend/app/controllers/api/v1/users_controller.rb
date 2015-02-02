class Api::V1::UsersController < ApplicationController
  respond_to :json
  before_filter :authenticate_user!, except: [:index, :show]
  after_filter :verify_authorized, except: [:index, :show, :update]

  # GET /api/v1/users
  # GET /api/v1/users.json
  def index
    @users = User.all
    render 'api/v1/users/index'
  end

  # GET /api/v1/users/1
  # GET /api/v1/users/1.json
  def show
    @user = User.find(params[:id])
    render 'api/v1/users/show'
  end

  # PATCH/PUT /api/v1/users
  # PATCH/PUT /api/v1/users.json
  def update
    @user = current_user
    if @user.update(update_user_params)
      render 'api/v1/users/show'
    else
      render json: @user.errors, status: :unprocessable_entity
    end
  end

  def update_user_params
    params.require(:user).permit(
        :name, :bio, :avatar, :facebook_account, :twitter_account)
  end

end
